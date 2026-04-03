DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollGender') THEN
    CREATE TYPE "PayrollGender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'PayrollEmployee'
      AND column_name = 'gender'
      AND udt_name <> 'PayrollGender'
  ) THEN
    ALTER TABLE "PayrollEmployee"
      ALTER COLUMN "gender" TYPE "PayrollGender"
      USING (
        CASE
          WHEN "gender" IS NULL THEN NULL
          WHEN UPPER("gender"::text) IN ('FEMALE', 'KADIN') THEN 'FEMALE'::"PayrollGender"
          WHEN UPPER("gender"::text) IN ('MALE', 'ERKEK') THEN 'MALE'::"PayrollGender"
          WHEN UPPER("gender"::text) IN ('OTHER', 'DIGER', 'DİĞER') THEN 'OTHER'::"PayrollGender"
          ELSE 'UNSPECIFIED'::"PayrollGender"
        END
      );
  END IF;
END $$;
