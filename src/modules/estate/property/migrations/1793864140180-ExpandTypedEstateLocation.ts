import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds typed selections while retaining the legacy canonical ID for rolling deployments. */
export class ExpandTypedEstateLocation1793864140180 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tbl_estate
        ADD COLUMN fk_urban_ward_id uuid REFERENCES tbl_ward(id) ON DELETE RESTRICT,
        ADD COLUMN fk_commune_id uuid REFERENCES tbl_ward(id) ON DELETE RESTRICT,
        ADD COLUMN fk_special_zone_id uuid REFERENCES tbl_ward(id) ON DELETE RESTRICT;
      CREATE INDEX idx_estate_urban_ward ON tbl_estate(fk_urban_ward_id);
      CREATE INDEX idx_estate_commune ON tbl_estate(fk_commune_id);
      CREATE INDEX idx_estate_special_zone ON tbl_estate(fk_special_zone_id);

      CREATE FUNCTION sync_estate_typed_location() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE unit_type text; unit_province uuid; selected_id uuid;
      BEGIN
        -- Old writers only change the canonical column; discard the previous typed selection.
        IF TG_OP = 'UPDATE' THEN
          IF NEW.fk_ward_id IS DISTINCT FROM OLD.fk_ward_id
             AND ROW(NEW.fk_urban_ward_id, NEW.fk_commune_id, NEW.fk_special_zone_id)
                 IS NOT DISTINCT FROM ROW(OLD.fk_urban_ward_id, OLD.fk_commune_id, OLD.fk_special_zone_id) THEN
            NEW.fk_urban_ward_id := NULL;
            NEW.fk_commune_id := NULL;
            NEW.fk_special_zone_id := NULL;
          END IF;
        END IF;
        IF num_nonnulls(NEW.fk_urban_ward_id, NEW.fk_commune_id, NEW.fk_special_zone_id) > 1 THEN
          RAISE EXCEPTION 'Select exactly one administrative unit' USING ERRCODE = '23514';
        END IF;
        selected_id := COALESCE(NEW.fk_urban_ward_id, NEW.fk_commune_id, NEW.fk_special_zone_id);
        IF selected_id IS NOT NULL AND NEW.fk_ward_id IS NOT NULL AND selected_id <> NEW.fk_ward_id THEN
          RAISE EXCEPTION 'Typed and canonical location must agree' USING ERRCODE = '23514';
        END IF;
        NEW.fk_ward_id := COALESCE(NEW.fk_ward_id, selected_id);
        SELECT type, fk_province_id INTO unit_type, unit_province
          FROM tbl_ward WHERE id = NEW.fk_ward_id FOR SHARE;
        IF NOT FOUND OR unit_province IS DISTINCT FROM NEW.fk_province_id
           OR unit_type NOT IN ('ward', 'commune', 'special_zone') THEN
          RAISE EXCEPTION 'Administrative unit must belong to the selected province' USING ERRCODE = '23514';
        END IF;
        IF (NEW.fk_urban_ward_id IS NOT NULL AND unit_type <> 'ward')
           OR (NEW.fk_commune_id IS NOT NULL AND unit_type <> 'commune')
           OR (NEW.fk_special_zone_id IS NOT NULL AND unit_type <> 'special_zone') THEN
          RAISE EXCEPTION 'Administrative unit type does not match the selected field' USING ERRCODE = '23514';
        END IF;
        NEW.fk_urban_ward_id := CASE WHEN unit_type = 'ward' THEN NEW.fk_ward_id END;
        NEW.fk_commune_id := CASE WHEN unit_type = 'commune' THEN NEW.fk_ward_id END;
        NEW.fk_special_zone_id := CASE WHEN unit_type = 'special_zone' THEN NEW.fk_ward_id END;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_estate_typed_location BEFORE INSERT OR UPDATE ON tbl_estate
        FOR EACH ROW EXECUTE FUNCTION sync_estate_typed_location();

      -- Existing records are converted by the explicit, idempotent data migration.
      ALTER TABLE tbl_estate ADD CONSTRAINT ck_estate_one_typed_location
        CHECK (num_nonnulls(fk_urban_ward_id, fk_commune_id, fk_special_zone_id) = 1
          AND COALESCE(fk_urban_ward_id, fk_commune_id, fk_special_zone_id) = fk_ward_id) NOT VALID;

      CREATE FUNCTION protect_referenced_location_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF ROW(NEW.type, NEW.fk_province_id) IS DISTINCT FROM ROW(OLD.type, OLD.fk_province_id)
           AND EXISTS (SELECT 1 FROM tbl_estate WHERE fk_ward_id = OLD.id) THEN
          RAISE EXCEPTION 'Cannot reclassify a location referenced by an estate' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER trg_protect_referenced_location BEFORE UPDATE OF type, fk_province_id ON tbl_ward
        FOR EACH ROW EXECUTE FUNCTION protect_referenced_location_identity();
    `);
  }

  /** Canonical IDs are kept throughout expansion, so rollback preserves every address. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER trg_protect_referenced_location ON tbl_ward;
      DROP FUNCTION protect_referenced_location_identity();
      DROP TRIGGER trg_estate_typed_location ON tbl_estate;
      DROP FUNCTION sync_estate_typed_location();
      ALTER TABLE tbl_estate DROP CONSTRAINT ck_estate_one_typed_location,
        DROP COLUMN fk_urban_ward_id, DROP COLUMN fk_commune_id, DROP COLUMN fk_special_zone_id;
    `);
  }
}
