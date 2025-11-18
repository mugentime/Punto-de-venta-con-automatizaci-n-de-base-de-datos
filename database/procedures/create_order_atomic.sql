-- Stored Procedure: create_order_atomic
-- Atomically creates an order with stock updates and credit management
-- Handles idempotency to prevent duplicate orders
-- All operations succeed or fail together (transaction safety)

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_id VARCHAR(255),
  p_client_name VARCHAR(255),
  p_service_type VARCHAR(50),
  p_payment_method VARCHAR(50),
  p_items JSONB,
  p_subtotal NUMERIC(10, 2),
  p_discount NUMERIC(10, 2),
  p_tip NUMERIC(10, 2),
  p_total NUMERIC(10, 2),
  p_user_id VARCHAR(255),
  p_customer_id VARCHAR(255),
  p_idempotency_key VARCHAR(255)
)
RETURNS TABLE(
  order_id VARCHAR(255),
  is_duplicate BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_existing_order_id VARCHAR(255);
  v_customer_credit NUMERIC(10, 2);
  v_credit_limit NUMERIC(10, 2);
  v_item RECORD;
  v_credit_id VARCHAR(255);
BEGIN
  -- Check idempotency: Has this request been processed recently?
  SELECT order_id INTO v_existing_order_id
  FROM idempotency_keys
  WHERE key = p_idempotency_key
    AND created_at > NOW() - INTERVAL '10 minutes';

  IF v_existing_order_id IS NOT NULL THEN
    -- Return existing order (duplicate request detected)
    RETURN QUERY SELECT v_existing_order_id, TRUE, NULL::TEXT;
    RETURN;
  END IF;

  -- Validate customer credit if applicable
  IF p_customer_id IS NOT NULL AND p_payment_method = 'Crédito' THEN
    SELECT "currentCredit", "creditLimit" INTO v_customer_credit, v_credit_limit
    FROM customers WHERE id = p_customer_id;

    IF v_customer_credit + p_total > v_credit_limit THEN
      RETURN QUERY SELECT NULL::VARCHAR, FALSE, 'Credit limit exceeded';
      RETURN;
    END IF;
  END IF;

  -- Insert order
  INSERT INTO orders (
    id,
    "clientName",
    "serviceType",
    "paymentMethod",
    items,
    subtotal,
    discount,
    tip,
    total,
    "userId",
    "customerId",
    created_at
  )
  VALUES (
    p_id,
    p_client_name,
    p_service_type,
    p_payment_method,
    p_items,
    p_subtotal,
    p_discount,
    p_tip,
    p_total,
    p_user_id,
    p_customer_id,
    NOW()
  );

  -- Store idempotency key for this order
  INSERT INTO idempotency_keys (
    key,
    order_id,
    resource_type,
    created_at,
    expires_at
  )
  VALUES (
    p_idempotency_key,
    p_id,
    'order',
    NOW(),
    NOW() + INTERVAL '24 hours'
  );

  -- Update stock for each item in the order
  -- Skip service items (IDs starting with special prefixes) that don't exist in products table
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id VARCHAR, quantity INTEGER)
  LOOP
    -- Skip service items (e.g., 'COWORK_SERVICE', 'TIP_', etc.)
    -- Only update stock for actual products in the products table
    IF v_item.id NOT LIKE 'COWORK_%' AND v_item.id NOT LIKE 'TIP_%' AND v_item.id NOT LIKE 'SERVICE_%' THEN
      UPDATE products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.id;

      -- Check if stock went negative (overselling protection)
      IF (SELECT stock FROM products WHERE id = v_item.id) < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_item.id;
      END IF;
    END IF;
  END LOOP;

  -- Update customer credit if applicable
  IF p_customer_id IS NOT NULL AND p_payment_method = 'Crédito' THEN
    -- Generate credit ID
    v_credit_id := 'credit-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000000)::INT;

    -- Insert credit record
    INSERT INTO customer_credits (
      id,
      "customerId",
      "orderId",
      amount,
      type,
      status,
      description,
      created_at
    )
    VALUES (
      v_credit_id,
      p_customer_id,
      p_id,
      p_total,
      'charge',
      'pending',
      'Orden #' || p_id,
      NOW()
    );

    -- Update customer's current credit balance
    UPDATE customers
    SET "currentCredit" = "currentCredit" + p_total
    WHERE id = p_customer_id;
  END IF;

  -- Return success
  RETURN QUERY SELECT p_id, FALSE, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will automatically rollback on exception
    RETURN QUERY SELECT NULL::VARCHAR, FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql;
