-- Migration 002: Create atomic order creation stored procedure
-- Purpose: Ensure atomicity in order creation with inventory updates

CREATE OR REPLACE FUNCTION create_order_atomic(
    p_order_data JSONB,
    p_items JSONB,
    p_idempotency_key VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_id INTEGER;
    v_result JSONB;
    v_item JSONB;
    v_product_id INTEGER;
    v_quantity INTEGER;
    v_current_stock INTEGER;
BEGIN
    -- Start transaction (implicit in function)

    -- Check idempotency key if provided
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_data INTO v_result
        FROM idempotency_keys
        WHERE key = p_idempotency_key
        AND status = 'completed'
        AND expires_at > CURRENT_TIMESTAMP;

        IF FOUND THEN
            RETURN v_result;
        END IF;

        -- Store idempotency key as pending
        INSERT INTO idempotency_keys (key, request_data, status)
        VALUES (p_idempotency_key, jsonb_build_object('order', p_order_data, 'items', p_items), 'pending')
        ON CONFLICT (key) DO NOTHING;
    END IF;

    -- Create order
    INSERT INTO orders (
        customer_id,
        user_id,
        total,
        discount,
        tip,
        payment_method,
        status,
        notes,
        created_at
    )
    VALUES (
        (p_order_data->>'customer_id')::INTEGER,
        (p_order_data->>'user_id')::INTEGER,
        (p_order_data->>'total')::NUMERIC,
        COALESCE((p_order_data->>'discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'tip')::NUMERIC, 0),
        p_order_data->>'payment_method',
        COALESCE(p_order_data->>'status', 'completed'),
        p_order_data->>'notes',
        COALESCE((p_order_data->>'created_at')::TIMESTAMP, CURRENT_TIMESTAMP)
    )
    RETURNING id INTO v_order_id;

    -- Insert order items and update inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::INTEGER;
        v_quantity := (v_item->>'quantity')::INTEGER;

        -- Check current stock
        SELECT stock INTO v_current_stock
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;  -- Lock row for update

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product_id %: available=%, requested=%',
                v_product_id, v_current_stock, v_quantity;
        END IF;

        -- Insert order item
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            price
        )
        VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            (v_item->>'price')::NUMERIC
        );

        -- Update product stock
        UPDATE products
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    -- Build result
    v_result := jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'message', 'Order created successfully'
    );

    -- Update idempotency key status
    IF p_idempotency_key IS NOT NULL THEN
        UPDATE idempotency_keys
        SET status = 'completed',
            response_data = v_result
        WHERE key = p_idempotency_key;
    END IF;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Mark idempotency key as failed
    IF p_idempotency_key IS NOT NULL THEN
        UPDATE idempotency_keys
        SET status = 'failed',
            response_data = jsonb_build_object('error', SQLERRM)
        WHERE key = p_idempotency_key;
    END IF;

    RAISE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_order_atomic IS 'Atomically creates an order with inventory updates and idempotency support';
