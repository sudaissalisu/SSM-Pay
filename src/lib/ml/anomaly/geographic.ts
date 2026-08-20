/**
 * Geographic Anomaly Detection Functions
 * @module ml/anomaly/geographic
 * @description Geographic velocity, location anomaly, and impossible travel detection.
 */

import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import {
  TransactionData,
  DetectionResult,
  AnomalyCategory,
  AnomalySeverity,
  UserProfile,
  GeoPoint,
  ThresholdConfig,
  EARTH_RADIUS_KM,
} from './types';

// ============== Distance Calculations ==============

/**
 * Calculate the Haversine distance between two geographic points
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============== Location Risk Calculation ==============

/**
 * Calculate risk score for a new location
 */
export function calculateLocationRisk(countryCode: string, profile: UserProfile): number {
  let risk = 40;
  
  // High-risk countries (simplified list)
  const highRiskCountries = new Set([
    'NG', 'GH', 'KE',
  ]);
  
  if (highRiskCountries.has(countryCode)) {
    risk += 20;
  }
  
  if (profile.knownLocations.size >= 3) {
    risk += 15;
  }
  
  if (profile.accountAgeDays < 7) {
    risk += 15;
  }
  
  return clamp(risk, 0, 100);
}

/**
 * Clamp value between bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============== Geographic Analysis ==============

/**
 * Run geographic analysis on transaction
 */
export function runGeographicAnalysis(
  transaction: TransactionData,
  profile: UserProfile | undefined,
  geoHistory: Map<string, GeoPoint[]>,
  thresholds: ThresholdConfig
): DetectionResult[] {
  const results: DetectionResult[] = [];
  
  if (!profile) {
    return results;
  }
  
  // New country check
  const isNewCountry = !profile.knownLocations.has(transaction.countryCode);
  
  if (isNewCountry && profile.knownLocations.size > 0) {
    const riskScore = calculateLocationRisk(transaction.countryCode, profile);
    
    if (riskScore > thresholds.newLocationRiskThreshold) {
      results.push({
        isAnomalous: true,
        category: AnomalyCategory.GEOGRAPHIC,
        severity: riskScore > 80 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        confidence: clamp(riskScore / 100, 0, 1),
        score: riskScore,
        threshold: thresholds.newLocationRiskThreshold,
        actualValue: riskScore,
        description: `Transaction from new/unusual location: ${transaction.countryCode}`,
        details: {
          newCountry: transaction.countryCode,
          knownCountries: Array.from(profile.knownLocations),
          riskScore,
        },
        detectedAt: new Date(),
      });
    }
  }
  
  // Distance/velocity analysis if coordinates available
  if (transaction.latitude && transaction.longitude) {
    const userGeoHistory = geoHistory.get(transaction.customerId) || [];
    
    if (userGeoHistory.length > 0) {
      const lastLocation = userGeoHistory[userGeoHistory.length - 1];
      const distance = calculateHaversineDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        transaction.latitude,
        transaction.longitude
      );
      
      const timeDiffMinutes = (transaction.timestamp.getTime() - lastLocation.timestamp.getTime()) / 60000;
      
      // Check for impossible travel
      if (distance > thresholds.maxGeoDistanceKm) {
        if (timeDiffMinutes < thresholds.minTimeForDistanceMinutes) {
          const requiredTime = distance / 900; // Assuming max 900 km/h travel speed
          
          results.push({
            isAnomalous: true,
            category: AnomalyCategory.GEOGRAPHIC,
            severity: AnomalySeverity.CRITICAL,
            confidence: 0.95,
            score: distance,
            threshold: thresholds.maxGeoDistanceKm,
            actualValue: distance,
            description: `Impossible travel detected: ${distance.toFixed(0)}km in ${timeDiffMinutes.toFixed(0)}min`,
            details: {
              distanceKm: distance.toFixed(2),
              timeDiffMinutes: timeDiffMinutes.toFixed(2),
              lastLocation: {
                latitude: lastLocation.latitude,
                longitude: lastLocation.longitude,
                countryCode: lastLocation.countryCode,
              },
              currentLocation: {
                latitude: transaction.latitude,
                longitude: transaction.longitude,
                countryCode: transaction.countryCode,
              },
              estimatedMinTravelTime: requiredTime,
            },
            detectedAt: new Date(),
          });
        }
      }
      
      // Update geo history
      const geoPoint: GeoPoint = {
        latitude: transaction.latitude,
        longitude: transaction.longitude,
        countryCode: transaction.countryCode,
        timestamp: transaction.timestamp,
      };
      
      userGeoHistory.push(geoPoint);
      if (userGeoHistory.length > 100) {
        userGeoHistory.shift();
      }
      geoHistory.set(transaction.customerId, userGeoHistory);
    }
  }
  
  return results;
}
