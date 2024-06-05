import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	LinearScale,
	Tooltip,
} from "chart.js"

import { bounds, merge } from "./algo"
import type { ExponentialHistogram } from "./validation"

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip)

const COLOURS = ["#0451A5", "#098658"]

const histograms: ExponentialHistogram[] = []

export function create(canvas: HTMLCanvasElement): Chart {
	return new Chart(canvas, {
		type: "bar",
		data: { datasets: [] },
		options: {
			responsive: true,
			scales: {
				y: { display: true, beginAtZero: true },
				x: { display: true, offset: false, grid: { offset: false } },
				xx: { display: false, offset: true, stacked: true },
			},
		},
	})
}

export function update(
	id: number,
	chart: Chart,
	histogram: ExponentialHistogram,
) {
	histograms[id] = histogram

	const bucketCounts = [
		...(histogram.negative?.bucketCounts?.reverse() ?? []),
		histogram.zeroCount ?? 0,
		...(histogram.positive?.bucketCounts ?? []),
	]
	const bucketBounds = bounds(histogram)

	const labels = [
		"-∞",
		...bucketBounds.map((n) => n.toPrecision(5).replace(/\.?0+$/, "")),
		"∞",
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
	chart.data.labels = labels
	chart.options.plugins = {
		tooltip: {
			callbacks: {
				title: ([ctx]) => {
					if (!ctx) return

					const [lowerBound, upperBound] = labels.slice(
						ctx.dataIndex,
						ctx.dataIndex + 2,
					)

					let [lowerBracket, upperBracket] = ["(", ")"]
					if (lowerBound!.startsWith("-") && lowerBound !== "-∞") {
						lowerBracket = "["
					}
					if (!upperBound!.startsWith("-") && upperBound !== "∞") {
						upperBracket = "]"
					}

					return `${lowerBracket}${lowerBound!}, ${upperBound!}${upperBracket}`
				},
			},
		},
	}

	chart.update()
}
