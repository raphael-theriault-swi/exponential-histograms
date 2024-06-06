import "./style.scss"
import "mathjax/tex-chtml"

import { merge } from "./algo"
import * as charts from "./charts"
import * as monaco from "./monaco"
import type { ExponentialHistogram } from "./validation"

const [first, second, merged] = [
	...document.querySelectorAll<HTMLDivElement>("main > .histogram"),
]

const updateMerged = mergedHistogram(merged!)
histogram(0, first!, updateMerged)
histogram(1, second!, updateMerged)

function histogram(
	id: 0 | 1,
	div: HTMLDivElement,
	updateMerged: (id: 0 | 1, data: ExponentialHistogram) => void,
) {
	const chartCanvas = div.querySelector<HTMLCanvasElement>(".chart > canvas")!
	const editorDiv = div.querySelector<HTMLDivElement>(".editor")!

	const chart = charts.create(chartCanvas)
	monaco.create(id, editorDiv, {}, (data) => {
		charts.update(id, chart, data)
		updateMerged(id, data)
	})
}

function mergedHistogram(
	div: HTMLDivElement,
): (id: 0 | 1, data: ExponentialHistogram) => void {
	const infoList = div.querySelector<HTMLUListElement>(".info")!
	const chartCanvas = div.querySelector<HTMLCanvasElement>(".chart > canvas")!
	const editorDiv = div.querySelector<HTMLDivElement>(".editor")!

	const chart = charts.create(chartCanvas)
	const editor = monaco.create(-1, editorDiv, {
		readOnly: true,
	})

	const histograms: [
		ExponentialHistogram | undefined,
		ExponentialHistogram | undefined,
	] = [undefined, undefined]

	return (id, data) => {
		histograms[id] = data
		if (!histograms[0] || !histograms[1]) return

		const merged = merge(histograms[0], histograms[1])

		infoList.replaceChildren(
			...merged.info.map((info) => {
				const node = document.createElement("li")
				node.textContent = info
				return node
			}),
		)
		;(self as unknown as { MathJax: { typeset?(): void } }).MathJax.typeset?.()

		editor.setValue(JSON.stringify(merged.h, null, 2))
		charts.updateMerged(chart, merged)
	}
}
