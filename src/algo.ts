import { idf, nf } from "./util"
import type { ExponentialHistogram } from "./validation"

export function bounds(histogram: ExponentialHistogram) {
	const b = 2 ** (2 ** -histogram.scale)
	const f = (i: number, o?: number) => b ** (i + (o ?? 0))
	const fP = (i: number) => f(i, histogram.positive?.offset)
	const fN = (i: number) => -f(i, histogram.negative?.offset)

	const iN = [...(histogram.negative?.bucketCounts ?? []), 0].keys()
	const iP = [...(histogram.positive?.bucketCounts ?? []), 0].keys()

	return [...[...iN].reverse().map(fN), ...[...iP].map(fP)]
}

export interface Merged {
	h: Required<ExponentialHistogram>
	counts: {
		zero: [number, number]
		positive: [number[], number[]]
		negative: [number[], number[]]
	}
	info: Info
}
export type Info = (string | [string, Info])[]

export function merge(
	first: ExponentialHistogram,
	second: ExponentialHistogram,
): Merged {
	const f = { id: 0, h: first }
	const s = { id: 1, h: second }
	console.dir(f)
	console.dir(s)

	const [lo, hi] = first.scale <= second.scale ? [f, s] : [s, f]
	const merged: Merged = {
		h: {
			scale: lo.h.scale,
			zeroCount: 0,
			positive: {
				offset: 0,
				bucketCounts: [],
			},
			negative: {
				offset: 0,
				bucketCounts: [],
			},
		},
		counts: {
			zero: [0, 0],
			positive: [[], []],
			negative: [[], []],
		},
		info: [],
	}

	const factor = 2 ** (hi.h.scale - lo.h.scale)
	merged.info.push(
		`Every $2^{${hi.h.scale} - ${lo.h.scale}} = ${factor}$ buckets from histogram ${idf(hi.id)} will be merged into one.`,
	)

	// This could normally be done while initialising "merged" if we didn't need to print it
	let info: Info = []
	for (const { id, h } of [lo, hi]) {
		if (h.zeroCount) {
			merged.h.zeroCount += h.zeroCount
			merged.counts.zero[id] += h.zeroCount
			info.push(`$${h.zeroCount}$ from ${idf(id)}`)
		}
	}
	if (info.length > 0) {
		merged.info.push([`Merging zero buckets`, info])
	}

	const signs = ["positive", "negative"] as const
	for (const s of signs) {
		info = []
		merged.info.push([`Merging ${s} buckets`, info])

		const loOffset = lo.h[s]?.offset ?? 0
		const hiOffset = hi.h[s]?.offset ?? 0

		let hiOffsetNorm = hiOffset / factor
		info.push(
			`Normalising histogram ${idf(hi.id)}'s offset to $${hiOffset} \\div ${factor} = ${nf(hiOffsetNorm)}$.`,
		)
		if (!Number.isInteger(hiOffsetNorm)) {
			if (hi.h.zeroCount) {
				hiOffsetNorm = Math.ceil(hiOffsetNorm)
				info.push(
					`Rounding up histogram ${idf(hi.id)}'s normalised offset to ${hiOffsetNorm} as its zero bucket is not empty.`,
				)
			} else {
				hiOffsetNorm = Math.floor(hiOffsetNorm)
				info.push(
					`Rounding down histogram ${idf(hi.id)}'s normalised offset to ${hiOffsetNorm} as its zero bucket is empty.`,
				)
			}
		}

		// This decision tree could be simplified in an actual implementation
		// that doesn't need to list out what it's doing
		let mergedOffset: number
		if (loOffset === hiOffsetNorm) {
			mergedOffset = loOffset
			info.push(
				`Histogram ${idf(lo.id)}'s offset and histogram ${idf(hi.id)}'s normalised offset are both $${mergedOffset}$.`,
			)
		} else if (loOffset < hiOffsetNorm) {
			if (hi.h.zeroCount) {
				mergedOffset = hiOffsetNorm
				info.push(
					`Histogram ${idf(lo.id)}'s offset is lower than histogram ${idf(hi.id)}'s normalised offset, but ${idf(hi.id)}'s zero bucket is not empty. Incrementing ${idf(lo.id)}'s offset to $${mergedOffset}$.`,
				)
			} else {
				mergedOffset = loOffset
				info.push(
					`Histogram ${idf(lo.id)}'s offset is lower than histogram ${idf(hi.id)}'s normalised offset, and ${idf(hi.id)}'s zero bucket is empty. Decrementing ${idf(hi.id)}'s normalised offset to $${mergedOffset}$.`,
				)
			}
		} else {
			if (lo.h.zeroCount) {
				mergedOffset = loOffset
				info.push(
					`Histogram ${idf(hi.id)}'s normalised offset is lower than histogram ${idf(lo.id)}'s offset, but ${idf(lo.id)}'s zero bucket is not empty. Incrementing ${idf(hi.id)}'s normalised offset to $${mergedOffset}$.`,
				)
			} else {
				mergedOffset = hiOffsetNorm
				info.push(
					`Histogram ${idf(hi.id)}'s normalised offset is lower than histogram ${idf(lo.id)}'s offset, and ${idf(lo.id)}'s zero bucket is empty. Decrementing ${idf(lo.id)}'s offset to $${mergedOffset}$.`,
				)
			}
		}
		merged.h[s].offset = mergedOffset

		const loFirstBucket = mergedOffset - loOffset
		const hiFirstBucket = mergedOffset * factor - hiOffset
		console.log(
			`${s} ${mergedOffset} * ${factor} - ${hiOffset} = ${hiFirstBucket}`,
		)

		let extraInfo: Info
		for (const { firstBucket, h, id, f } of [
			{ ...lo, firstBucket: loFirstBucket, f: 1 },
			{ ...hi, firstBucket: hiFirstBucket, f: factor },
		]) {
			extraInfo = []
			if (h[s]?.bucketCounts?.length) {
				info.push([`Merging ${idf(id)}`, extraInfo])
			}

			for (
				let sourceIdx = Math.min(0, firstBucket);
				sourceIdx < (h[s]?.bucketCounts?.length ?? 0);
				sourceIdx++
			) {
				const count = h[s]?.bucketCounts?.[sourceIdx] ?? 0

				if (sourceIdx < firstBucket) {
					extraInfo.push(`$${count}$ from bucket ${sourceIdx} into zero bucket`)

					merged.h.zeroCount += count
					merged.counts.zero[id] += count
				} else {
					const mergedIdx = Math.floor((sourceIdx - firstBucket) / f)
					extraInfo.push(
						`$${count}$ from bucket ${sourceIdx} into bucket ${mergedIdx}`,
					)

					merged.h[s].bucketCounts![mergedIdx] ??= 0
					merged.h[s].bucketCounts![mergedIdx] += count

					merged.counts[s][id]![mergedIdx] ??= 0
					merged.counts[s][id]![mergedIdx] += count
				}
			}
		}
	}

	return merged
}
