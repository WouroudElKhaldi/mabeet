-- Places and experiences store their region, so searching for a region is an exact match instead of guessing from
-- the free-text town. Existing rows get it from their town, with the same town list as src/config/regions.ts.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Offering" ADD COLUMN     "region" TEXT;

-- CreateIndex
CREATE INDEX "Business_region_idx" ON "Business"("region");

-- CreateIndex
CREATE INDEX "Offering_region_idx" ON "Offering"("region");


UPDATE "Business" SET "region" = CASE
    WHEN lower("area") ~ '\m(tripoli|batroun|ehden|zgharta|bcharre|bsharri|tannourine|douma|hasroun|qadisha|koura|amioun|chekka|anfeh|akkar|halba|qobayat|kousba|bakhoun|north|north lebanon|the north|shmal|el shmal)\M' THEN 'north'
    WHEN lower("area") ~ '\m(chouf|deir el qamar|beiteddine|baakline|barouk|maasser|aley|bhamdoun|souk el gharb|metn|broummana|beit mery|baskinta|bikfaya|dhour el choueir|zaarour|keserwan|jounieh|harissa|faraya|faqra|kfardebian|mzaar|ehmej|byblos|jbeil|laqlouq|annaya|aaqoura|mount lebanon|jabal lebanon)\M' THEN 'mount-lebanon'
    WHEN lower("area") ~ '\m(beirut|achrafieh|hamra|gemmayzeh|mar mikhael|verdun|ras beirut|badaro|beirut)\M' THEN 'beirut'
    WHEN lower("area") ~ '\m(bekaa|zahle|chtaura|anjar|baalbek|hermel|rachaya|kefraya|ammiq|taanayel|saghbine|jdita|bekaa|beqaa|the bekaa)\M' THEN 'bekaa'
    WHEN lower("area") ~ '\m(saida|sidon|tyre|sour|jezzine|nabatieh|naqoura|marjayoun|bint jbeil|hasbaya|rmeish|south|south lebanon|the south|jnoub)\M' THEN 'south'
  END
WHERE "area" IS NOT NULL;

UPDATE "Offering" SET "region" = CASE
    WHEN lower("area") ~ '\m(tripoli|batroun|ehden|zgharta|bcharre|bsharri|tannourine|douma|hasroun|qadisha|koura|amioun|chekka|anfeh|akkar|halba|qobayat|kousba|bakhoun|north|north lebanon|the north|shmal|el shmal)\M' THEN 'north'
    WHEN lower("area") ~ '\m(chouf|deir el qamar|beiteddine|baakline|barouk|maasser|aley|bhamdoun|souk el gharb|metn|broummana|beit mery|baskinta|bikfaya|dhour el choueir|zaarour|keserwan|jounieh|harissa|faraya|faqra|kfardebian|mzaar|ehmej|byblos|jbeil|laqlouq|annaya|aaqoura|mount lebanon|jabal lebanon)\M' THEN 'mount-lebanon'
    WHEN lower("area") ~ '\m(beirut|achrafieh|hamra|gemmayzeh|mar mikhael|verdun|ras beirut|badaro|beirut)\M' THEN 'beirut'
    WHEN lower("area") ~ '\m(bekaa|zahle|chtaura|anjar|baalbek|hermel|rachaya|kefraya|ammiq|taanayel|saghbine|jdita|bekaa|beqaa|the bekaa)\M' THEN 'bekaa'
    WHEN lower("area") ~ '\m(saida|sidon|tyre|sour|jezzine|nabatieh|naqoura|marjayoun|bint jbeil|hasbaya|rmeish|south|south lebanon|the south|jnoub)\M' THEN 'south'
  END
WHERE "area" IS NOT NULL;

