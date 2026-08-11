import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { buildXlsxWorkbook } from "./xlsx";

test("buildXlsxWorkbook creates a valid workbook package with escaped cells", () => {
  const workbook = buildXlsxWorkbook(
    "Members & Admins",
    ["Name", "Company"],
    [["Adit <Admin>", "Pyranthus & Co."]],
  );

  assert.equal(workbook.subarray(0, 2).toString(), "PK");
  const files = unzipSync(workbook);
  assert.deepEqual(Object.keys(files).sort(), [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/workbook.xml",
    "xl/worksheets/sheet1.xml",
  ]);
  assert.match(strFromU8(files["xl/workbook.xml"]), /Members &amp; Admins/);
  assert.match(strFromU8(files["xl/worksheets/sheet1.xml"]), /Adit &lt;Admin&gt;/);
  assert.match(strFromU8(files["xl/worksheets/sheet1.xml"]), /Pyranthus &amp; Co\./);
});
