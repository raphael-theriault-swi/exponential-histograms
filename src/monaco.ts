import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
import Worker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker"

import {
	type ExponentialHistogram,
	exponentialHistogramSchema,
	parse,
	random,
} from "./validation"

self.MonacoEnvironment = {
	getWorker: (_id, label) => {
		switch (label) {
			case "json": {
				return new JsonWorker()
			}
			default: {
				return new Worker()
			}
		}
	},
}

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
	validate: true,
	schemas: [
		{
			uri: "https://opentelemetry.io/exponential-histogram-schema.json",
			fileMatch: ["*"],
			schema: exponentialHistogramSchema,
		},
	],
})

export function create(
	id: number,
	el: HTMLElement,
	options?: monaco.editor.IStandaloneEditorConstructionOptions,
	change?: (histogram: ExponentialHistogram) => void,
): monaco.editor.IStandaloneCodeEditor {
	const storageKey = `editor-${id}`
	const ro = options?.readOnly ?? false

	const value = localStorage.getItem(storageKey)

	const editor = monaco.editor.create(el, {
		language: "json",
		tabSize: 2,
		formatOnPaste: true,
		lineNumbers: "off",
		glyphMargin: false,
		minimap: {
			enabled: false,
		},
		...options,
	})

	if (!ro) {
		editor.addAction({
			id: "histogram.randomize",
			label: "Randomize Data",
			contextMenuGroupId: "1_modification",
			run: (editor) => {
				editor.setValue(JSON.stringify(random(), null, 2))
			},
		})

		editor.onDidChangeModelContent(() => {
			const value = editor.getValue()
			localStorage.setItem(storageKey, value)

			const data = parse(value)
			if (data) {
				change?.(data)
			}
		})
		editor.onDidBlurEditorWidget(() => {
			void editor.getAction("editor.action.formatDocument")?.run()
		})

		if (value) {
			editor.setValue(value)
		} else {
			void editor.getAction("histogram.randomize")?.run()
		}
	}

	return editor
}

export * from "monaco-editor"
