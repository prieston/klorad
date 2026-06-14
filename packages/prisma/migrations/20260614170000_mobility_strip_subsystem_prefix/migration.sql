-- Strip the `<subsystem>:` prefix the sync runner accidentally stored on
-- `MobilityDevice.externalDeviceId`. The packed form ("cctv:24432") is
-- the connector framework's internal id; the raw form ("24432") is what
-- the upstream API expects in its single-device endpoints + what the
-- drawer's source-URL panel should display.
--
-- The unique constraint `(sourceId, externalDeviceId)` still holds: the
-- prefix is identical for every row from the same subsystem of the same
-- source, so stripping it can't introduce collisions inside a source.

UPDATE "MobilityDevice"
SET "externalDeviceId" = SUBSTR(
  "externalDeviceId",
  LENGTH("subsystem") + 2
)
WHERE
  "externalDeviceId" LIKE "subsystem" || ':%'
  AND POSITION(':' IN "externalDeviceId") = LENGTH("subsystem") + 1;
