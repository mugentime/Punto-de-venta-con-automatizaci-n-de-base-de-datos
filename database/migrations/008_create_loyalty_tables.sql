-- Migration 008: Loyalty program tables (wooden QR cards / tarjetas de lealtad)
--
-- clientes: one row per physical QR card. Cards are generated INACTIVE (activo=false)
--   carrying only a token (e.g. CNK-0042). nombre / telefono / fecha_registro get
--   filled the moment the customer activates the card at /loyalty/activar/:token.
--
-- sellos: one row per stamp (a visit). "At most one stamp per client per day" is
--   enforced in application code (routes/loyalty.js), NOT by a DB constraint, so that
--   manual backfills / corrections remain possible without fighting the schema.

BEGIN;

CREATE TABLE IF NOT EXISTS clientes (
  id             SERIAL PRIMARY KEY,
  token          VARCHAR(20) NOT NULL UNIQUE,
  nombre         VARCHAR(255),
  telefono       VARCHAR(50),
  activo         BOOLEAN NOT NULL DEFAULT false,
  fecha_registro TIMESTAMP WITH TIME ZONE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sellos (
  id         SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  venta_id   VARCHAR(255)
);

-- Fast lookup of a client's stamps (the hot path on every scan / profile view).
CREATE INDEX IF NOT EXISTS idx_sellos_cliente_id ON sellos(cliente_id);

COMMIT;
