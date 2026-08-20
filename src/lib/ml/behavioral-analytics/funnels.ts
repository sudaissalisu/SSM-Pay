/**
 * Conversion Funnel Analysis Module
 * Tracks and analyzes user conversion funnels
 *
 * @module ml/behavioral-analytics/funnels
 */

import { logger } from '@/lib/logger';
import {
  BehaviorEvent,
  EventType,
  ConversionRecord,
  ConversionFunnel,
  FunnelStep,
  FunnelAnalysis,
  DropOffPoint,
} from './types';
import { filterEventsByUser, filterEventsByTimeRange } from './events';

// ============== Funnel Definitions ==============

/**
 * Default payment funnel definition
 */
export const PAYMENT_FUNNEL: ConversionFunnel = {
  id: 'payment_funnel',
  name: 'Payment Conversion',
  description: 'Tracks user journey from landing to successful payment',
  steps: [
    { id: 'landing', name: 'Landing Page', eventType: 'page_view', page: '/' },
    { id: 'init_payment', name: 'Initiate Payment', eventType: 'payment_init' },
    { id: 'complete_details', name: 'Complete Details', eventType: 'form_submit' },
    { id: 'confirm', name: 'Confirm Payment', eventType: 'click' },
    { id: 'success', name: 'Payment Success', eventType: 'payment_complete' },
  ],
};

/**
 * Default signup funnel definition
 */
export const SIGNUP_FUNNEL: ConversionFunnel = {
  id: 'signup_funnel',
  name: 'User Registration',
  description: 'Tracks user registration flow',
  steps: [
    { id: 'visit', name: 'Visit Site', eventType: 'page_view' },
    { id: 'click_signup', name: 'Click Sign Up', eventType: 'click' },
    { id: 'start_form', name: 'Start Form', eventType: 'form_start' },
    { id: 'submit_form', name: 'Submit Form', eventType: 'form_submit' },
    { id: 'complete', name: 'Account Created', eventType: 'signup' },
  ],
};

// ============== Funnel Analysis ==============

/**
 * Analyze conversion funnel performance
 */
export function analyzeFunnel(
  funnel: ConversionFunnel,
  events: BehaviorEvent[],
  options?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }
): FunnelAnalysis {
  let filteredEvents = events;
  
  // Apply filters
  if (options?.startDate && options?.endDate) {
    filteredEvents = filterEventsByTimeRange(filteredEvents, options.startDate, options.endDate);
  }
  if (options?.userId) {
    filteredEvents = filterEventsByUser(filteredEvents, options.userId);
  }
  
  // Calculate step conversions
  const stepResults = funnel.steps.map((step, index) => {
    const usersAtStep = getUsersAtStep(filteredEvents, step, index);
    return {
      ...step,
      users: usersAtStep,
      conversionRate: index === 0 ? 1 : usersAtStep / Math.max(1, getTotalUsersEntering(filteredEvents, funnel.steps[0])),
      dropOffRate: 0, // Calculated below
      avgTimeInSeconds: calculateAvgTimeToStep(filteredEvents, step),
    };
  });
  
  // Calculate drop-off rates
  for (let i = 1; i < stepResults.length; i++) {
    const prevUsers = stepResults[i - 1].users;
    const currUsers = stepResults[i].users;
    stepResults[i].dropOffRate = prevUsers > 0 ? (prevUsers - currUsers) / prevUsers : 0;
  }
  
  // Identify drop-off points
  const dropOffPoints: DropOffPoint[] = stepResults
    .filter(s => s.dropOffRate > 0.2) // More than 20% drop-off
    .map(step => ({
      stepId: step.id,
      stepName: step.name,
      dropOffRate: step.dropOffRate,
      usersLost: Math.round(step.users * step.dropOffRate),
      potentialRevenueImpact: estimateRevenueImpact(step),
    }));
  
  // Overall conversion rate
  const totalEntering = stepResults[0]?.users || 0;
  const totalCompleting = stepResults[stepResults.length - 1]?.users || 0;
  const overallConversionRate = totalEntering > 0 ? totalCompleting / totalEntering : 0;
  
  return {
    funnelId: funnel.id,
    funnelName: funnel.name,
    analysisPeriod: {
      start: options?.startDate || new Date(0),
      end: options?.endDate || new Date(),
    },
    totalUsersAnalyzed: filteredEvents.length,
    steps: stepResults,
    overallConversionRate,
    dropOffPoints,
    recommendations: generateFunnelRecommendations(dropOffPoints),
  };
}

/**
 * Get number of users who reached a specific step
 */
function getUsersAtStep(
  events: BehaviorEvent[],
  step: FunnelStep,
  stepIndex: number
): number {
  if (stepIndex === 0) {
    // First step: count unique users who triggered the event
    if (step.page) {
      return new Set(events.filter(e => e.page === step.page).map(e => e.userId)).size;
    }
    return new Set(events.filter(e => e.eventType === step.eventType).map(e => e.userId)).size;
  }
  
  // Subsequent steps: count users who completed all previous steps
  const matchingEvents = step.page
    ? events.filter(e => e.page === step.page)
    : events.filter(e => e.eventType === step.eventType);
    
  return new Set(matchingEvents.map(e => e.userId)).size;
}

/**
 * Get total users entering the funnel
 */
function getTotalUsersEntering(events: BehaviorEvent[], firstStep: FunnelStep): number {
  if (firstStep.page) {
    return new Set(events.filter(e => e.page === firstStep.page).map(e => e.userId)).size;
  }
  return new Set(events.filter(e => e.eventType === firstStep.eventType).map(e => e.userId)).size;
}

/**
 * Calculate average time to reach a step
 */
function calculateAvgTimeToStep(events: BehaviorEvent[], step: FunnelStep): number {
  // Simplified: would need session start times for accurate calculation
  return 30; // placeholder in seconds
}

/**
 * Estimate revenue impact of drop-off
 */
function estimateRevenueImpact(step: FunnelStep): number {
  // Placeholder: would need actual revenue data
  return step.users * 100; // Assume $100 average transaction value
}

/**
 * Generate recommendations based on drop-off points
 */
function generateFunnelRecommendations(dropOffs: DropOffPoint[]): string[] {
  const recommendations: string[] = [];
  
  for (const drop of dropOffs) {
    if (drop.dropOffRate > 0.5) {
      recommendations.push(`Critical drop-off at ${drop.stepName}: ${Math.round(drop.dropOffRate * 100)}% of users lost`);
    } else if (drop.dropOffRate > 0.3) {
      recommendations.push(`Consider optimizing ${drop.stepName} step to reduce ${Math.round(drop.dropOffRate * 100)}% drop-off`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Funnel performing well with no significant drop-offs');
  }
  
  return recommendations;
}

// ============== Conversion Tracking ==============

/**
 * Record a conversion event
 */
export function recordConversion(
  userId: string,
  funnelId: string,
  stepId: string,
  metadata?: Record<string, unknown>
): ConversionRecord {
  return {
    userId,
    funnelId,
    stepId,
    convertedAt: new Date(),
    metadata: metadata || {},
  };
}

/**
 * Track multiple funnel conversions
 */
export function trackFunnelConversions(
  events: BehaviorEvent[],
  funnel: ConversionFunnel
): Map<string, ConversionRecord[]> {
  const conversions = new Map<string, ConversionRecord[]>();
  
  // Group events by user
  const userEvents = new Map<string, BehaviorEvent[]>();
  for (const event of events) {
    const existing = userEvents.get(event.userId) || [];
    existing.push(event);
    userEvents.set(event.userId, existing);
  }
  
  // Analyze each user's journey through the funnel
  for (const [userId, userEventList] of userEvents) {
    const userConversions: ConversionRecord[] = [];
    
    for (const step of funnel.steps) {
      const completedStep = userEventList.some(e => 
        e.eventType === step.eventType && (!step.page || e.page === step.page)
      );
      
      if (completedStep) {
        userConversions.push(recordConversion(userId, funnel.id, step.id));
      } else {
        break; // User didn't complete this step, stop tracking
      }
    }
    
    if (userConversions.length > 0) {
      conversions.set(userId, userConversions);
    }
  }
  
  return conversions;
}
