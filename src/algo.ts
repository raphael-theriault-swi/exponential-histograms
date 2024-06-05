import type { ExponentialHistogram } from "./validation"

export interface MergedHistograms {
	ids: number[]
	id: string
	scale: number
	zeroCount: number
	positive: {
		offset: number
		bucketCounts: number[][]
	}
	negative: {
		offset: number
		bucketCounts: number[][]
	}
}

export function bounds(histogram: ExponentialHistogram) {
	const b = 2 ** (2 ** -histogram.scale)
	const f = (i: number, o?: number) => b ** (i + (o ?? 0))
	const fP = (i: number) => f(i, histogram.positive?.offset)
	const fN = (i: number) => -f(i, histogram.negative?.offset)

	const iN = (histogram.negative?.bucketCounts ?? []).keys()
	const iP = (histogram.positive?.bucketCounts ?? []).keys()

	return [...[...iN].reverse().map(fN), ...[...iP].map(fP)]
}

export function merge(
	first: ExponentialHistogram,
	...rest: ExponentialHistogram[]
): { merged: MergedHistograms; info: string[] } {
	let id = 0
	const merged = asMerged(id++, first)
	const info: string[] = []

	for (const h of rest) {
		const current = asMerged(id++, h)

		const [wider, narrower] =
			merged.scale <= current.scale ? [merged, current] : [current, merged]
		const squash = 2 ** (narrower.scale - wider.scale)
		if (wider.scale !== narrower.scale) {
			info.push(
				`Histogram ${wider.id} is wider than histogram ${narrower.id}. Every ${squash} buckets of histogram ${narrower.id} will be merged into a single one.`,
			)
		}

		const buckets = [
			["negative", wider.negative, narrower.negative],
			["positive", wider.positive, narrower.positive],
		] as const
		for (const [type, wider, narrower] of buckets) {
			if (wider.offset < narrower.offset) {
			} else if (narrower.offset < wider.offset) {
			}
		}
	}
}

function asMerged(
	id: number,
	histogram: ExponentialHistogram,
): MergedHistograms {
	return {
		ids: [id],
		get id() {
			return this.ids.map((id) => id + 1).join(" & ")
		},

		scale: histogram.scale,
		zeroCount: histogram.scale,
		positive: {
			offset: histogram.positive?.offset ?? 0,
			bucketCounts: [histogram.positive?.bucketCounts ?? []],
		},
		negative: {
			offset: histogram.negative?.offset ?? 0,
			bucketCounts: [histogram.positive?.bucketCounts ?? []],
		},
	}
}
