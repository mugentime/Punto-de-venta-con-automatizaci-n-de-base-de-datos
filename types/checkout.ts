/**
 * Checkout State Machine Types
 * Defines the valid states and transitions for the checkout flow
 */

import type { CartItem } from '../types';

export enum CheckoutState {
  IDLE = 'IDLE',
  SELECTING_DETAILS = 'SELECTING_DETAILS',
  VALIDATING = 'VALIDATING',
  SUBMITTING = 'SUBMITTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum CheckoutAction {
  START_CHECKOUT = 'START_CHECKOUT',
  CANCEL = 'CANCEL',
  SUBMIT = 'SUBMIT',
  SUBMIT_SUCCESS = 'SUBMIT_SUCCESS',
  SUBMIT_ERROR = 'SUBMIT_ERROR',
  RETRY = 'RETRY',
  RESET = 'RESET',
}

export interface CheckoutContext {
  cart: CartItem[];
  clientName: string;
  serviceType: 'Mesa' | 'Para llevar';
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Crédito';
  customerId?: string;
  tip?: number;
  error?: string;
}

/**
 * State transition matrix
 * Defines which actions are valid from each state
 */
export const checkoutTransitions: Record<
  CheckoutState,
  Partial<Record<CheckoutAction, CheckoutState>>
> = {
  [CheckoutState.IDLE]: {
    [CheckoutAction.START_CHECKOUT]: CheckoutState.SELECTING_DETAILS,
  },
  [CheckoutState.SELECTING_DETAILS]: {
    [CheckoutAction.CANCEL]: CheckoutState.IDLE,
    [CheckoutAction.SUBMIT]: CheckoutState.VALIDATING,
  },
  [CheckoutState.VALIDATING]: {
    [CheckoutAction.SUBMIT]: CheckoutState.SUBMITTING,
    [CheckoutAction.SUBMIT_ERROR]: CheckoutState.ERROR,
    [CheckoutAction.CANCEL]: CheckoutState.IDLE,
  },
  [CheckoutState.SUBMITTING]: {
    [CheckoutAction.SUBMIT_SUCCESS]: CheckoutState.SUCCESS,
    [CheckoutAction.SUBMIT_ERROR]: CheckoutState.ERROR,
  },
  [CheckoutState.ERROR]: {
    [CheckoutAction.RETRY]: CheckoutState.SELECTING_DETAILS,
    [CheckoutAction.CANCEL]: CheckoutState.IDLE,
    [CheckoutAction.RESET]: CheckoutState.IDLE,
  },
  [CheckoutState.SUCCESS]: {
    [CheckoutAction.RESET]: CheckoutState.IDLE,
  },
};

/**
 * Check if a transition is valid
 * @param fromState Current state
 * @param action Action to perform
 * @returns True if transition is valid
 */
export function isValidTransition(
  fromState: CheckoutState,
  action: CheckoutAction
): boolean {
  return checkoutTransitions[fromState]?.[action] !== undefined;
}

/**
 * Get the next state after performing an action
 * @param fromState Current state
 * @param action Action to perform
 * @returns Next state, or undefined if transition is invalid
 */
export function getNextState(
  fromState: CheckoutState,
  action: CheckoutAction
): CheckoutState | undefined {
  return checkoutTransitions[fromState]?.[action];
}
