-- ROLLBACK del sistema de lealtad (revierte la migración 008).
--
-- ⚠️  EJECUCIÓN MANUAL. Este archivo vive en scripts/ a propósito, FUERA de
--     database/migrations/, para que el runner automático de migraciones nunca
--     lo aplique solo (si estuviera en migrations/, el deploy borraría las tablas).
--
-- Qué hace:
--   * elimina las tablas de lealtad (sellos primero por la FK, luego clientes)
--   * borra el registro de la migración 008 en schema_migrations, de modo que un
--     redeploy futuro la vuelva a aplicar desde cero.
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/rollback-loyalty.sql
--   (o pega el contenido en la consola SQL de Railway)

BEGIN;

DROP TABLE IF EXISTS sellos;
DROP TABLE IF EXISTS clientes;

DELETE FROM schema_migrations WHERE migration_name = '008_create_loyalty_tables';

COMMIT;
