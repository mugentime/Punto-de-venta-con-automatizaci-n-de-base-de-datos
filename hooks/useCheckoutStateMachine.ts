/**
 * Checkout State Machine Hook
 * Manages the checkout flow state transitions
 */

import { useReducer, useCallback } from 'react';
import {
  CheckoutState,
  CheckoutAction,
  CheckoutContext,
  checkoutTransitions,
  isValidTransition,
} from '../types/checkout';
import type { CartItem } from '../types';

interface State {
  current: CheckoutState;
  context: CheckoutContext;
}

type Action =
  | { type: CheckoutAction.START_CHECKOUT }
  | { type: CheckoutAction.SUBMIT; payload: Partial<CheckoutContext> }
  | { type: CheckoutAction.SUBMIT_SUCCESS }
  | { type: CheckoutAction.SUBMIT_ERROR; payload: string }
  | { type: CheckoutAction.CANCEL }
  | { type: CheckoutAction.RETRY }
  | { type: CheckoutAction.RESET };

function checkoutReducer(state: State, action: Action): State {
  const nextState = checkoutTransitions[state.current]?.[action.type];

  if (!nextState) {
    console.warn(
      `[CheckoutStateMachine] Invalid transition: ${state.current} -> ${action.type}`
    );
    return state;
  }

  console.log(
    `[CheckoutStateMachine] Transition: ${state.current} -> ${nextState} (action: ${action.type})`
  );

  switch (action.type) {
    case CheckoutAction.SUBMIT:
      return {
        current: nextState,
        context: { ...state.context, ...action.payload },
      };

    case CheckoutAction.SUBMIT_ERROR:
      return {
        current: nextState,
        context: { ...state.context, error: action.payload },
      };

    case CheckoutAction.CANCEL:
    case CheckoutAction.RESET:
      return {
        current: nextState,
        context: { ...state.context, error: undefined },
      };

    case CheckoutAction.RETRY:
      return {
        current: nextState,
        context: { ...state.context, error: undefined },
      };

    default:
      return { ...state, current: nextState };
  }
}

export interface UseCheckoutStateMachineReturn {
  state: CheckoutState;
  context: CheckoutContext;
  canSubmit: boolean;
  isProcessing: boolean;
  isError: boolean;
  isSuccess: boolean;
  dispatch: React.Dispatch<Action>;
  startCheckout: () => void;
  cancel: () => void;
  submit: (details: Partial<CheckoutContext>) => void;
  submitSuccess: () => void;
  submitError: (error: string) => void;
  retry: () => void;
  reset: () => void;
}

/**
 * Custom hook for managing checkout state machine
 * @param initialCart Initial cart items
 * @returns State machine state and actions
 */
export function useCheckoutStateMachine(
  initialCart: CartItem[]
): UseCheckoutStateMachineReturn {
  const [state, dispatch] = useReducer(checkoutReducer, {
    current: CheckoutState.IDLE,
    context: {
      cart: initialCart,
      clientName: '',
      serviceType: 'Mesa',
      paymentMethod: 'Efectivo',
    } as CheckoutContext,
  });

  // Computed states
  const canSubmit = state.current === CheckoutState.SELECTING_DETAILS;
  const isProcessing =
    state.current === CheckoutState.VALIDATING ||
    state.current === CheckoutState.SUBMITTING;
  const isError = state.current === CheckoutState.ERROR;
  const isSuccess = state.current === CheckoutState.SUCCESS;

  // Action creators
  const startCheckout = useCallback(() => {
    dispatch({ type: CheckoutAction.START_CHECKOUT });
  }, []);

  const cancel = useCallback(() => {
    dispatch({ type: CheckoutAction.CANCEL });
  }, []);

  const submit = useCallback((details: Partial<CheckoutContext>) => {
    dispatch({ type: CheckoutAction.SUBMIT, payload: details });
  }, []);

  const submitSuccess = useCallback(() => {
    dispatch({ type: CheckoutAction.SUBMIT_SUCCESS });
  }, []);

  const submitError = useCallback((error: string) => {
    dispatch({ type: CheckoutAction.SUBMIT_ERROR, payload: error });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: CheckoutAction.RETRY });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: CheckoutAction.RESET });
  }, []);

  return {
    state: state.current,
    context: state.context,
    canSubmit,
    isProcessing,
    isError,
    isSuccess,
    dispatch,
    startCheckout,
    cancel,
    submit,
    submitSuccess,
    submitError,
    retry,
    reset,
  };
}
