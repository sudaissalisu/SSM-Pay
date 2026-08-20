/**
 * Behavior-Based Recommendations Module
 * Generates personalized recommendations based on user behavior
 *
 * @module ml/behavioral-analytics/recommendations
 */

import { logger } from '@/lib/logger';
import {
  BehaviorEvent,
  UserProfile,
  BehaviorRecommendation,
  RecommendationCategory,
  RecommendationAction,
  ImpactEstimate,
} from './types';
import { determineUserSegments, getPrimarySegment } from './segments';

// ============== Recommendation Generation ==============

/**
 * Generate personalized recommendations for a user
 */
export function generateRecommendations(
  profile: UserProfile,
  events: BehaviorEvent[]
): BehaviorRecommendation[] {
  const recommendations: BehaviorRecommendation[] = [];
  const segment = getPrimarySegment(profile);
  
  // Segment-based recommendations
  const segmentRecs = getSegmentBasedRecommendations(segment);
  recommendations.push(...segmentRecs);
  
  // Behavior pattern recommendations
  const patternRecs = getPatternBasedRecommendations(profile, events);
  recommendations.push(...patternRecs);
  
  // Engagement-based recommendations
  const engagementRecs = getEngagementBasedRecommendations(profile);
  recommendations.push(...engagementRecs);
  
  // Sort by priority and limit to top 10
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
}

/**
 * Get recommendations based on user segment
 */
function getSegmentBasedRecommendations(segment: string): BehaviorRecommendation[] {
  const recMap: Record<string, BehaviorRecommendation[]> = {
    power_user: [
      {
        id: 'rec_power_referral',
        category: 'engagement',
        title: 'Join Referral Program',
        description: 'You\'re a power user! Share your experience and earn rewards.',
        actions: [{ type: 'navigate', target: '/referrals', label: 'Learn More' }],
        impact: { score: 85, confidence: 0.9 },
        priority: 8,
      },
      {
        id: 'rec_power_advanced',
        category: 'feature_adoption',
        title: 'Try Advanced Analytics',
        description: 'Unlock detailed insights about your payment patterns.',
        actions: [{ type: 'navigate', target: '/analytics', label: 'View Analytics' }],
        impact: { score: 75, confidence: 0.85 },
        priority: 7,
      },
    ],
    new_user: [
      {
        id: 'rec_new_tour',
        category: 'onboarding',
        title: 'Take the Guided Tour',
        description: 'Learn how to make the most of SSM-Pay in 5 minutes.',
        actions: [{ type: 'navigate', target: '/tour', label: 'Start Tour' }],
        impact: { score: 90, confidence: 0.95 },
        priority: 10,
      },
      {
        id: 'rec_new_first_payment',
        category: 'conversion',
        title: 'Make Your First Payment',
        description: 'Experience seamless payments with Zainpay integration.',
        actions: [{ type: 'navigate', target: '/payment', label: 'Start Payment' }],
        impact: { score: 95, confidence: 0.92 },
        priority: 9,
      },
    ],
    at_risk: [
      {
        id: 'rec_atrisk_offer',
        category: 'retention',
        title: 'Special Offer for You',
        description: 'We miss you! Here\'s 10% off your next transaction.',
        actions: [{ type: 'promo', code: 'WELCOMEBACK10', label: 'Apply Discount' }],
        impact: { score: 80, confidence: 0.7 },
        priority: 10,
      },
    ],
    browser: [
      {
        id: 'rec_browser_convert',
        category: 'conversion',
        title: 'Ready to Get Started?',
        description: 'Creating an account takes less than a minute.',
        actions: [{ type: 'navigate', target: '/signup', label: 'Sign Up Free' }],
        impact: { score: 70, confidence: 0.6 },
        priority: 8,
      },
    ],
  };
  
  return recMap[segment] || [];
}

/**
 * Get recommendations based on behavior patterns
 */
function getPatternBasedRecommendations(
  profile: UserProfile,
  events: BehaviorEvent[]
): BehaviorRecommendation[] {
  const recs: BehaviorRecommendation[] = [];
  
  // Check for abandoned payment attempts
  const abandonedPayments = events.filter(e => 
    e.eventType === 'payment_init' && 
    !events.some(later => 
      later.eventType === 'payment_complete' && 
      later.timestamp > e.timestamp &&
      later.sessionId === e.sessionId
    )
  );
  
  if (abandonedPayments.length > 0) {
    recs.push({
      id: 'rec_abandoned_cart',
      category: 'conversion',
      title: 'Complete Your Payment',
      description: `You have ${abandonedPayments.length} unfinished payment(s).`,
      actions: [{ type: 'navigate', target: '/payment', label: 'Complete Now' }],
      impact: { score: 88, confidence: 0.85 },
      priority: 9,
    });
  }
  
  // Check for error events
  const recentErrors = events.filter(e => 
    e.eventType === 'error' && 
    Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
  );
  
  if (recentErrors.length > 0) {
    recs.push({
      id: 'rec_error_help',
      category: 'support',
      title: 'Need Help?',
      description: 'We noticed you encountered some issues. Let us help!',
      actions: [{ type: 'navigate', target: '/support', label: 'Get Support' }],
      impact: { score: 70, confidence: 0.8 },
      priority: 7,
    });
  }
  
  // Check for frequent page visits without action
  const pageVisits = events.filter(e => e.eventType === 'page_view').length;
  const actionsTaken = events.filter(e => 
    !['page_view', 'scroll'].includes(e.eventType)
  ).length;
  
  if (pageVisits > 10 && actionsTaken / pageVisits < 0.2) {
    recs.push({
      id: 'rec_engage_more',
      category: 'engagement',
      title: 'Discover Features',
      description: 'Explore what you can do with SSM-Pay.',
      actions: [{ type: 'navigate', target: '/features', label: 'Explore' }],
      impact: { score: 60, confidence: 0.65 },
      priority: 5,
    });
  }
  
  return recs;
}

/**
 * Get recommendations based on engagement level
 */
function getEngagementBasedRecommendations(
  profile: UserProfile
): BehaviorRecommendation[] {
  const recs: BehaviorRecommendation[] = [];
  
  if (profile.scores.conversionPropensity < 30 && profile.totalEvents > 20) {
    recs.push({
      id: 'rec_boost_conversion',
      category: 'conversion',
      title: 'Try Our Secure Payments',
      description: 'Experience fast and secure transactions.',
      actions: [{ type: 'navigate', target: '/payment', label: 'Try Now' }],
      impact: { score: 72, confidence: 0.7 },
      priority: 6,
    });
  }
  
  if (profile.scores.explorationScore < 40) {
    recs.push({
      id: 'rec_explore',
      category: 'feature_adoption',
      title: 'Explore New Features',
      description: 'Discover tools you haven\'t tried yet.',
      actions: [{ type: 'navigate', target: '/dashboard', label: 'Explore' }],
      impact: { score: 55, confidence: 0.6 },
      priority: 4,
    });
  }
  
  return recs;
}

// ============== Platform-Level Recommendations ==============

/**
 * Generate platform-wide recommendations based on aggregate data
 */
export function generatePlatformRecommendations(
  profiles: UserProfile[],
  allEvents: BehaviorEvent[]
): BehaviorRecommendation[] {
  const recommendations: BehaviorRecommendation[] = [];
  
  // Analyze overall patterns
  const avgConversionRate = profiles.reduce((sum, p) => sum + p.conversionRate, 0) / Math.max(1, profiles.length);
  const avgEngagement = profiles.reduce((sum, p) => sum + p.scores.engagementScore, 0) / Math.max(1, profiles.length);
  
  if (avgConversionRate < 0.3) {
    recommendations.push({
      id: 'plat_improve_funnel',
      category: 'platform',
      title: 'Optimize Conversion Funnel',
      description: `Overall conversion rate is ${Math.round(avgConversionRate * 100)}%. Consider A/B testing.`,
      actions: [{ type: 'action', target: 'analytics', label: 'View Funnel' }],
      impact: { score: 82, confidence: 0.88 },
      priority: 10,
    });
  }
  
  if (avgEngagement < 50) {
    recommendations.push({
      id: 'plat_boost_engagement',
      category: 'platform',
      title: 'Boost User Engagement',
      description: `Average engagement score is ${Math.round(avgEngagement)}. Implement gamification?`,
      actions: [{ type: 'action', target: 'features', label: 'Plan Features' }],
      impact: { score: 75, confidence: 0.75 },
      priority: 8,
    });
  }
  
  return recommendations;
}
