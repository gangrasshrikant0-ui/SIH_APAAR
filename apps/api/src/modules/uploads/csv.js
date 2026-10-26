function parseCsv(input) {
    const records = [];
    let field = "";
    let record = [];
    let quoted = false;

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        const next = input[index + 1];
        if (character === '"' && quoted && next === '"') {
            field += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === "," && !quoted) {
            record.push(field);
            field = "";
        } else if ((character === "\n" || character === "\r") && !quoted) {
            if (character === "\r" && next === "\n") {
                index += 1;
            }
            record.push(field);
            if (record.some((value) => value.trim() !== "")) {
                records.push(record);
            }
            field = "";
            record = [];
        } else {
            field += character;
        }
    }

    if (quoted) {
        throw new Error("CSV contains an unterminated quoted field");
    }
    if (field !== "" || record.length > 0) {
        record.push(field);
        if (record.some((value) => value.trim() !== "")) {
            records.push(record);
        }
    }
    return records;
}

function recordsToRows(records) {
    if (records.length < 2) {
        throw new Error("CSV must include a header and at least one data row");
    }
    const headers = records[0].map((header) => header.trim().toLowerCase());
    const required = ["apaar_id", "student_name", "prn", "programme_code", "academic_year"];
    if (new Set(headers).size !== headers.length ||
        required.some((header) => !headers.includes(header))) {
        throw new Error(`CSV must include unique headers: ${required.join(", ")}`);
    }

    return records.slice(1).map((values, index) => {
        const row = {};
        headers.forEach((header, headerIndex) => {
            row[header] = (values[headerIndex] || "").trim();
        });
        row.row_number = index + 2;
        return row;
    });
}

module.exports = { parseCsv, recordsToRows };
