-- ROLLBACK del sistema de lealtad (revierte la migración 008).
--
-- ⚠️  EJECUCIÓN MANUAL. Este archivo vive en scripts/ a propósito, FUERA de
--     database/migrations/, para que el runner automático de migraciones nunca
--     lo aplique solo (si estuviera en migrations/, el deploy borraría las tablas).
--
-- Qué hace:
--   * elimina las tablas de lealtad (sellos primero por la FK, luego clientes)
--   * borra el registro de la migración 008 en schema_migrations.
--
-- ⚠️ IMPORTANTE: server.js crea estas tablas inline (CREATE TABLE IF NOT EXISTS) en
--    cada arranque. Si solo corres este script, el próximo reinicio las recreará
--    VACÍAS. Para un rollback real del feature:
--      1) revierte el código primero  ->  git revert <commit> && git push
--         (eso quita las rutas /loyalty y la creación inline de las tablas),
--      2) espera el redeploy,
--      3) recién entonces corre este script para eliminar las tablas.
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/rollback-loyalty.sql
--   (o pega el contenido en la consola SQL de Railway)

BEGIN;

DROP TABLE IF EXISTS sellos;
DROP TABLE IF EXISTS clientes;

DELETE FROM schema_migrations WHERE migration_name = '008_create_loyalty_tables';

COMMIT;
