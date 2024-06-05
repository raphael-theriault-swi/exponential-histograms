import {
	Array,
	Integer,
	Object,
	Optional,
	type StaticDecode,
	String,
	Transform,
	Union,
} from "@sinclair/typebox"
import { TypeCompiler } from "@sinclair/typebox/compiler"

const integerSchema = Union([
	Integer(),
	Transform(String({ pattern: "^[0-9]+$" }))
		.Decode((s) => Number.parseInt(s))
		.Encode((n) => n.toString()),
])
const bucketsSchema = Object({
	offset: Optional(integerSchema),
	bucketCounts: Optional(Array(integerSchema)),
})
export const exponentialHistogramSchema = Object({
	scale: integerSchema,
	zeroCount: Optional(integerSchema),
	positive: Optional(bucketsSchema),
	negative: Optional(bucketsSchema),
})

const exponentialHistogram = TypeCompiler.Compile(exponentialHistogramSchema)

export type ExponentialHistogram = StaticDecode<
	typeof exponentialHistogramSchema
>
export function parse(json: string): ExponentialHistogram | undefined {
	try {
		return exponentialHistogram.Decode(JSON.parse(json))
	} catch {
		return undefined
	}
}

export function random(): ExponentialHistogram {
	const [scale, positiveOffset, negativeOffset] = crypto
		.getRandomValues(new Uint8Array(64))
		.map((n) => n / 64)
	const [zeroCount, positiveCount, negativeCount] = crypto
		.getRandomValues(new Uint8Array(64))
		.map((n) => n / 32)
	const counts = crypto
		.getRandomValues(new Uint8Array(positiveCount! + negativeCount!))
		.map((n) => n / 16)
	return {
		scale: scale!,
		zeroCount: zeroCount,
		positive: {
			offset: positiveOffset,
			bucketCounts: [...counts.subarray(0, positiveCount)],
		},
		negative: {
			offset: negativeOffset,
			bucketCounts: [...counts.subarray(positiveCount)],
		},
	}
}
