/**
 * User Segmentation Module
 * Categorizes users into behavioral segments
 *
 * @module ml/behavioral-analytics/segments
 */

import { logger } from '@/lib/logger';
import {
  UserProfile,
  UserSegment,
  BehaviorScores,
  EngagementLevel,
  AdoptionStatus,
} from './types';

// ============== Segment Definitions ==============

/**
 * Available user segments with criteria
 */
export const SEGMENT_DEFINITIONS: Record<UserSegment, {
  name: string;
  description: string;
  criteria: (profile: UserProfile) => boolean;
}> = {
  power_user: {
    name: 'Power User',
    description: 'Highly engaged users who use advanced features frequently',
    criteria: (p) => p.scores.engagementScore >= 80 && p.adoptionStatus === 'power_user',
  },
  regular_user: {
    name: 'Regular User',
    description: 'Consistently active users with good engagement',
    criteria: (p) => p.scores.engagementScore >= 50 && p.scores.engagementScore < 80,
  },
  casual_user: {
    name: 'Casual User',
    description: 'Occasional users with low to moderate engagement',
    criteria: (p) => p.scores.engagementScore >= 20 && p.scores.engagementScore < 50,
  },
  new_user: {
    name: 'New User',
    description: 'Recently registered users still exploring',
    criteria: (p) => p.accountAgeDays <= 7 && p.totalEvents < 20,
  },
  at_risk: {
    name: 'At Risk',
    description: 'Users showing declining engagement patterns',
    criteria: (p) => p.scores.consistencyScore < 30 && p.accountAgeDays > 30,
  },
  churned: {
    name: 'Churned',
    description: 'Users who have not returned in a significant time',
    criteria: (p) => {
      const daysSinceActive = Math.floor(
        (Date.now() - p.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceActive > 30 && p.accountAgeDays > 14;
    },
  },
  converter: {
    name: 'Converter',
    description: 'Users who have completed payment transactions',
    criteria: (p) => p.conversionRate > 0 && p.totalEvents > 10,
  },
  browser: {
    name: 'Browser',
    description: 'Users who browse but rarely take action',
    criteria: (p) => 
      p.bounceRate > 0.5 && 
      p.scores.conversionPropensity < 20 && 
      p.totalEvents > 5,
  },
};

// ============== Segmentation Logic ==============

/**
 * Determine user segment(s) based on profile
 */
export function determineUserSegments(profile: UserProfile): UserSegment[] {
  const segments: UserSegment[] = [];
  
  for (const [segmentId, definition] of Object.entries(SEGMENT_DEFINITIONS)) {
    if (definition.criteria(profile)) {
      segments.push(segmentId as UserSegment);
    }
  }
  
  // Ensure at least one segment is assigned
  if (segments.length === 0) {
    segments.push('casual_user'); // Default fallback
  }
  
  return segments;
}

/**
 * Get primary segment (most specific match)
 */
export function getPrimarySegment(profile: UserProfile): UserSegment {
  const segments = determineUserSegments(profile);
  
  // Priority order for primary segment
  const priorityOrder: UserSegment[] = [
    'power_user',
    'converter',
    'regular_user',
    'at_risk',
    'churned',
    'new_user',
    'browser',
    'casual_user',
  ];
  
  for (const segment of priorityOrder) {
    if (segments.includes(segment)) {
      return segment;
    }
  }
  
  return 'casual_user';
}

/**
 * Get segment statistics across multiple profiles
 */
export function getSegmentStatistics(
  profiles: UserProfile[]
): Map<UserSegment, { count: number; percentage: number }> {
  const stats = new Map<UserSegment, number>();
  
  // Count each segment
  for (const profile of profiles) {
    const primarySegment = getPrimarySegment(profile);
    stats.set(primarySegment, (stats.get(primarySegment) || 0) + 1);
  }
  
  // Convert to percentages
  const total = profiles.length || 1;
  const result = new Map<UserSegment, { count: number; percentage: number }>();
  
  for (const [segment, count] of stats.entries()) {
    result.set(segment, {
      count,
      percentage: Math.round((count / total) * 100),
    });
  }
  
  return result;
}

/**
 * Filter profiles by segment
 */
export function filterBySegment(
  profiles: UserProfile[],
  segment: UserSegment
): UserProfile[] {
  return profiles.filter(p => determineUserSegments(p).includes(segment));
}

// ============== Segment-Specific Insights ==============

/**
 * Get insights for power users
 */
export function getPowerUserInsights(profiles: UserProfile[]): object {
  const powerUsers = filterBySegment(profiles, 'power_user');
  
  return {
    total: powerUsers.length,
    avgEngagementScore: calculateAverage(powerUsers, p => p.scores.engagementScore),
    avgConversionRate: calculateAverage(powerUsers, p => p.conversionRate),
    topPages: getCommonPages(powerUsers),
    recommendations: [
      'Offer referral program incentives',
      'Provide early access to new features',
      'Create ambassador program opportunities',
    ],
  };
}

/**
 * Get insights for at-risk users
 */
export function getAtRiskInsights(profiles: UserProfile[]): object {
  const atRiskUsers = filterBySegment(profiles, 'at_risk');
  
  return {
    total: atRiskUsers.length,
    avgDaysSinceLastActive: calculateAverage(atRiskUsers, p => 
      Math.floor((Date.now() - p.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    ),
    avgConsistencyScore: calculateAverage(atRiskUsers, p => p.scores.consistencyScore),
    recommendations: [
      'Send re-engagement email campaign',
      'Offer special promotions or discounts',
      'Request feedback via survey',
      'Highlight new features or improvements',
    ],
  };
}

// ============== Utility Functions ==============

/**
 * Calculate average of a numeric property across profiles
 */
function calculateAverage<T>(
  profiles: UserProfile[],
  extractor: (p: UserProfile) => T
): number where T is number {
  if (profiles.length === 0) return 0;
  
  const sum = profiles.reduce((acc, p) => acc + extractor(p), 0);
  return sum / profiles.length;
}

/**
 * Get most common pages among profiles
 */
function getCommonPages(profiles: UserProfile[]): string[] {
  const pageCounts = new Map<string, number>();
  
  for (const profile of profiles) {
    for (const pageFreq of profile.pageFrequencies.slice(0, 3)) {
      pageCounts.set(pageFreq.page, (pageCounts.get(pageFreq.page) || 0) + pageFreq.count);
    }
  }
  
  return Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([page]) => page);
}
