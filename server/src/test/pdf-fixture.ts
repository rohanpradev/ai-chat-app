export const selectablePdf = () => {
	const content = "BT /F1 12 Tf 72 720 Td (Upload extraction works) Tj ET";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`
	];
	let document = "%PDF-1.4\n";
	const offsets = objects.map((object, index) => {
		const offset = document.length;
		document += `${index + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xrefOffset = document.length;
	document += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
	return new File([document], "notes.pdf", { type: "application/pdf" });
};
