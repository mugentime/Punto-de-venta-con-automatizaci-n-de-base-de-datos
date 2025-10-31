-- Diagnóstico del registro del 30 de octubre con expectedCash incorrecto
-- Ejecuta este script conectado a la base de datos Railway

\echo '================================================'
\echo 'PASO 1: Ver el registro problemático del 30 oct'
\echo '================================================'

SELECT
    id,
    TO_CHAR("startTime" AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS') as inicio,
    TO_CHAR("endTime" AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS') as fin,
    "startAmount" as inicial,
    "endAmount" as final,
    "totalSales" as ventas_totales,
    "totalExpenses" as gastos,
    "expectedCash" as esperado_actual,
    difference as diferencia
FROM cash_sessions
WHERE DATE("startTime" AT TIME ZONE 'America/Mexico_City') = '2025-10-30'
AND status = 'closed';

\echo ''
\echo '================================================'
\echo 'PASO 2: Calcular ventas en efectivo del periodo'
\echo '================================================'

WITH session_info AS (
    SELECT
        id,
        "startTime",
        "endTime",
        "startAmount",
        "endAmount",
        "totalExpenses"
    FROM cash_sessions
    WHERE DATE("startTime" AT TIME ZONE 'America/Mexico_City') = '2025-10-30'
    AND status = 'closed'
    LIMIT 1
)
SELECT
    s.id as session_id,
    s."startAmount" as inicial,
    s."endAmount" as final,
    s."totalExpenses" as gastos_registrados,
    COALESCE(SUM(CASE WHEN o."paymentMethod" = 'Efectivo' THEN o.total ELSE 0 END), 0) as ventas_efectivo,
    (SELECT COALESCE(SUM(amount), 0)
     FROM cash_withdrawals w
     WHERE w.cash_session_id = s.id) as retiros,
    -- Cálculo CORRECTO: startAmount + cashSales - withdrawals
    (s."startAmount" +
     COALESCE(SUM(CASE WHEN o."paymentMethod" = 'Efectivo' THEN o.total ELSE 0 END), 0) -
     (SELECT COALESCE(SUM(amount), 0) FROM cash_withdrawals w WHERE w.cash_session_id = s.id)
    ) as esperado_correcto,
    -- Diferencia correcta
    (s."endAmount" -
     (s."startAmount" +
      COALESCE(SUM(CASE WHEN o."paymentMethod" = 'Efectivo' THEN o.total ELSE 0 END), 0) -
      (SELECT COALESCE(SUM(amount), 0) FROM cash_withdrawals w WHERE w.cash_session_id = s.id))
    ) as diferencia_correcta
FROM session_info s
LEFT JOIN orders o ON o.date >= s."startTime" AND o.date < COALESCE(s."endTime", NOW())
GROUP BY s.id, s."startAmount", s."endAmount", s."totalExpenses";

\echo ''
\echo '================================================'
\echo 'PASO 3: Buscar otros registros con problemas'
\echo '================================================'

SELECT
    id,
    TO_CHAR("startTime" AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') as fecha,
    "startAmount" as inicial,
    "expectedCash" as esperado,
    "endAmount" as final,
    difference as diferencia,
    CASE
        WHEN "expectedCash" < 0 THEN '❌ NEGATIVO'
        WHEN "expectedCash" < "startAmount" - 1000 THEN '⚠️ SOSPECHOSO'
        ELSE '✓ OK'
    END as estado
FROM cash_sessions
WHERE status = 'closed'
AND ("expectedCash" < 0 OR "expectedCash" < "startAmount" - 1000)
ORDER BY "startTime" DESC;
