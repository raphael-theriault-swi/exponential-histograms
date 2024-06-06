import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	LinearScale,
	Tooltip,
} from "chart.js"

import { bounds, type Merged } from "./algo"
import { idf, nf } from "./util"
import type { ExponentialHistogram } from "./validation"

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip)

const COLOURS = ["#0451A5", "#098658"]

export function create(canvas: HTMLCanvasElement): Chart {
	return new Chart(canvas, {
		type: "bar",
		data: { datasets: [] },
		options: {
			responsive: true,
			scales: {
				y: { display: true, beginAtZero: true, stacked: true },
				x: { display: true, offset: false, grid: { offset: false } },
				xx: { display: false, offset: true, stacked: true },
			},
			plugins: {
				tooltip: {
					callbacks: {
						title: ([ctx]) => {
							if (!ctx) return
							const labels = ctx.chart.data.labels
							if (!labels) return

							const [lowerBound, upperBound] = labels
								.slice(ctx.dataIndex, ctx.dataIndex + 2)
								.map(String)

							let [lowerBracket, upperBracket] = ["(", ")"]
							if (lowerBound!.startsWith("-")) {
								lowerBracket = "["
							}
							if (!upperBound!.startsWith("-")) {
								upperBracket = "]"
							}

							return `${lowerBracket}${lowerBound!}, ${upperBound!}${upperBracket}`
						},
					},
				},
			},
		},
	})
}

export function update(
	id: number,
	chart: Chart,
	histogram: ExponentialHistogram,
) {
	const bucketBounds = bounds(histogram)
	const bucketCounts = [
		...[...(histogram.negative?.bucketCounts ?? [])].reverse(),
		histogram.zeroCount ?? 0,
		...(histogram.positive?.bucketCounts ?? []),
	]

	chart.data.datasets = [
		{
			data: bucketCounts,
			xAxisID: "xx",
			barPercentage: 1,
			categoryPercentage: 1,
			backgroundColor: COLOURS[id],
			borderColor: COLOURS[id],
		},
	]
	chart.options.scales!.xx!.max = bucketCounts.length - 1
	chart.data.labels = bucketBounds.map(nf)

	chart.update()
}

export function updateMerged(chart: Chart, merged: Merged) {
	const bucketBounds = bounds(merged.h)

	const signs = ["positive", "negative"] as const
	for (const s of signs) {
		while (merged.counts[s][0].length < merged.counts[s][1].length) {
			merged.counts[s][0].push(0)
		}
		while (merged.counts[s][1].length < merged.counts[s][0].length) {
			merged.counts[s][1].push(0)
		}
	}
	const bucketCounts = [0, 1].map((i) => [
		...[...merged.counts.negative[i]!].reverse(),
		merged.counts.zero[i]!,
		...merged.counts.positive[i]!,
	])

	chart.data.datasets = bucketCounts.map((data, id) => ({
		label: idf(id),
		data,
		xAxisID: "xx",
		barPercentage: 1,
		categoryPercentage: 1,
		backgroundColor: COLOURS[id],
		borderColor: COLOURS[id],
	}))
	chart.options.scales!.xx!.max =
		Math.max(bucketCounts[0]!.length, bucketCounts[1]!.length) - 1
	chart.data.labels = bucketBounds.map(nf)

	chart.update()
}
