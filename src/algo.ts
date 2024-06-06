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
	info: string[]
}

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
	for (const { id, h } of [lo, hi]) {
		if (h.zeroCount) {
			merged.h.zeroCount += h.zeroCount
			merged.counts.zero[id] += h.zeroCount
			merged.info.push(
				`Adding histogram ${idf(id)}'s zero bucket count to the final zero bucket count.`,
			)
		}
	}

	const signs = ["positive", "negative"] as const
	for (const s of signs) {
		const loOffset = lo.h[s]?.offset ?? 0
		const hiOffset = hi.h[s]?.offset ?? 0

		let hiOffsetNorm = hiOffset / factor
		merged.info.push(
			`Normalising histogram ${idf(hi.id)}'s ${s} offset to $${hiOffset} \\div ${factor} = ${nf(hiOffsetNorm)}$.`,
		)
		if (!Number.isInteger(hiOffsetNorm)) {
			if (hi.h.zeroCount) {
				hiOffsetNorm = Math.ceil(hiOffsetNorm)
				merged.info.push(
					`Rounding up histogram ${idf(hi.id)}'s normalised ${s} offset to ${hiOffsetNorm} as its zero bucket is not empty and virtual empty buckets cannot be placed in it.`,
				)
			} else {
				hiOffsetNorm = Math.floor(hiOffsetNorm)
				merged.info.push(
					`Rounding down histogram ${idf(hi.id)}'s normalised ${s} offset to ${hiOffsetNorm} as its zero bucket is empty and virtual empty buckets can be placed in it.`,
				)
			}
		}

		// This decision tree could be simplified in an actual implementation
		// that doesn't need to list out what it's doing
		let mergedOffset: number
		if (loOffset === hiOffsetNorm) {
			mergedOffset = loOffset
			merged.info.push(
				`Histogram ${idf(lo.id)}'s ${s} offset and histogram ${idf(hi.id)}'s normalised ${s} offset are both $${mergedOffset}$ so the final offset is also $${mergedOffset}$.`,
			)
		} else if (loOffset < hiOffsetNorm) {
			if (hi.h.zeroCount) {
				mergedOffset = hiOffsetNorm
				merged.info.push(
					`Histogram ${idf(lo.id)}'s ${s} offset is lower than histogram ${idf(hi.id)}'s normalised ${s} offset, but histogram ${idf(hi.id)}'s zero bucket is not empty so its offset cannot be lowered by placing virtual empty buckets in it. The final ${s} offset is histogram ${idf(hi.id)}'s normalised offset of $${mergedOffset}$.`,
				)
			} else {
				mergedOffset = loOffset
				merged.info.push(
					`Histogram ${idf(lo.id)}'s ${s} offset is lower than histogram ${idf(hi.id)}'s normalised ${s} offset, and histogram ${idf(hi.id)}'s zero bucket is empty so its offset can be lowered by placing virtual empty buckets in it. The final ${s} offset is histogram ${idf(lo.id)}'s offset of $${mergedOffset}$.`,
				)
			}
		} else {
			if (lo.h.zeroCount) {
				mergedOffset = loOffset
				merged.info.push(
					`Histogram ${idf(hi.id)}'s normalised ${s} offset is lower than histogram ${idf(lo.id)}'s ${s} offset, but histogram ${idf(lo.id)}'s zero bucket is not empty so its offset cannot be lowered by placing virtual empty buckets in it. The final ${s} offset is histogram ${idf(lo.id)}'s offset of $${mergedOffset}$.`,
				)
			} else {
				mergedOffset = hiOffsetNorm
				merged.info.push(
					`Histogram ${idf(hi.id)}'s normalised ${s} offset is lower than histogram ${idf(lo.id)}'s ${s} offset, and histogram ${idf(lo.id)}'s zero bucket is empty so its offset can be lowered by placing virtual empty buckets in it. The final ${s} offset is histogram ${idf(hi.id)}'s normalised offset of $${mergedOffset}$.`,
				)
			}
		}
		merged.h[s].offset = mergedOffset

		// The following normally would not need to be duplicated

		const loFirstBucket = mergedOffset - loOffset
		if (loFirstBucket > 0) {
			for (let i = 0; i < loFirstBucket; i++) {
				const count = lo.h[s]?.bucketCounts?.[i] ?? 0
				merged.h.zeroCount += count
				merged.counts.zero[lo.id] += count
			}
			merged.info.push(
				`Adding the counts from histogram ${idf(lo.id)}'s ${s} buckets under index $${mergedOffset} - ${loOffset} = ${loFirstBucket}$ to the final zero bucket count.`,
			)
		} else if (loFirstBucket < 0) {
			merged.info.push(
				`Adding $${loOffset} - ${mergedOffset} = ${-loFirstBucket}$ virtual empty buckets to histogram ${idf(lo.id)}.`,
			)
		}

		const hiFirstBucket = (mergedOffset - hiOffsetNorm) * factor
		if (hiFirstBucket > 0) {
			for (let i = 0; i < hiFirstBucket; i++) {
				const count = hi.h[s]?.bucketCounts?.[i] ?? 0
				merged.h.zeroCount += count
				merged.counts.zero[hi.id] += count
			}
			merged.info.push(
				`Adding the counts from histogram ${idf(hi.id)}'s ${s} buckets under index $(${mergedOffset} - ${hiOffsetNorm}) \\cdot ${factor} = ${hiFirstBucket}$ to the final zero bucket count.`,
			)
		} else if (hiFirstBucket < 0) {
			merged.info.push(
				`Adding $(${hiOffsetNorm} - ${mergedOffset}) \\cdot ${factor} = ${-hiFirstBucket}$ virtual empty buckets to histogram ${idf(hi.id)}.`,
			)
		}

		for (const { firstBucket, h, id, f } of [
			{ ...lo, firstBucket: loFirstBucket, f: 1 },
			{ ...hi, firstBucket: hiFirstBucket, f: factor },
		]) {
			for (
				let sourceIdx = firstBucket;
				sourceIdx < (h[s]?.bucketCounts?.length ?? 0);
				sourceIdx++
			) {
				const mergedIdx = Math.floor((sourceIdx - firstBucket) / f)
				const count = h[s]?.bucketCounts?.[sourceIdx] ?? 0

				merged.h[s].bucketCounts![mergedIdx] ??= 0
				merged.h[s].bucketCounts![mergedIdx] += count

				merged.counts[s][id]![mergedIdx] ??= 0
				merged.counts[s][id]![mergedIdx] += count
			}

			merged.info.push(
				`Adding the counts from histogram ${idf(id)}'s ${s} buckets to the final ${s} bucket counts.`,
			)
		}
	}

	return merged
}
