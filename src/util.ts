export function idf(n: number): string {
	return ["A", "B"][n]!
}

export function nf(n: number): string {
	return n.toPrecision(5).replace(/\.?0+$/, "")
}
