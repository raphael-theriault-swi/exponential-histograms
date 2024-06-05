import "./style.scss"
import "mathjax/tex-chtml"

import * as charts from "./charts"
import * as monaco from "./monaco"
import { parse, random } from "./validation"

// init html elements
const histograms =
	document.querySelectorAll<HTMLDivElement>("main > .histogram")
for (const [id, div] of histograms.entries()) {
	const chartCanvas = div.querySelector<HTMLCanvasElement>(".chart > canvas")!
	const editorDiv = div.querySelector<HTMLDivElement>(".editor")!
	if (id + 1 === histograms.length) {
		mergedHistogram(chartCanvas, editorDiv)
	} else {
		histogram(id, chartCanvas, editorDiv)
	}
}

function histogram(
	id: number,
	chartCanvas: HTMLCanvasElement,
	editorDiv: HTMLDivElement,
) {
	const chart = charts.create(chartCanvas)
	monaco.create(id, editorDiv, {}, (data) => {
		charts.update(id, chart, data)
	})
}

function mergedHistogram(
	chartCanvas: HTMLCanvasElement,
	editorDiv: HTMLDivElement,
) {
	const construction = String.raw`
 _   _           _                                          
| | | |_ __   __| | ___ _ __                                
| | | | '_ \ / _' |/ _ \ '__|                               
| |_| | | | | (_| |  __/ |                                  
 \___/|_| |_|\__,_|\___|_|                                  
  ____                _                   _   _             
 / ___|___  _ __  ___| |_ _ __ _   _  ___| |_(_) ___  _ __  
| |   / _ \| '_ \/ __| __| '__| | | |/ __| __| |/ _ \| '_ \ 
| |__| (_) | | | \__ \ |_| |  | |_| | (__| |_| | (_) | | | |
 \____\___/|_| |_|___/\__|_|   \__,_|\___|\__|_|\___/|_| |_|
`.slice(1, -1)

	const chart = charts.create(chartCanvas)
	const editor = monaco.create(-1, editorDiv, {
		value: construction,
		readOnly: true,
	})
}
