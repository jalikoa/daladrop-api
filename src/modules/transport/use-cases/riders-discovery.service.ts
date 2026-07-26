import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { haversineKm, toNumber } from '../../merchants/domain/geo.util';

const DEFAULT_RADIUS_KM = 5;

@Injectable()
export class RidersDiscoveryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async nearby(lat: number, lng: number, radiusKm?: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng query params are required');
    }
    const radius =
      radiusKm && Number.isFinite(radiusKm) && radiusKm > 0
        ? radiusKm
        : DEFAULT_RADIUS_KM;

    // Bounding-box prefilter keeps the scan O(candidates in area) instead of
    // loading every available rider on the platform.
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    const riders = await this.prisma.rider.findMany({
      where: {
        isAvailable: true,
        deletedAt: null,
        currentLatitude: {
          not: null,
          gte: lat - latDelta,
          lte: lat + latDelta,
        },
        currentLongitude: {
          not: null,
          gte: lng - lngDelta,
          lte: lng + lngDelta,
        },
      },
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        vehicleType: true,
        ratingAvg: true,
      },
      take: 500,
    });

    const nearby = riders
      .map((rider) => {
        const riderLat = toNumber(rider.currentLatitude);
        const riderLng = toNumber(rider.currentLongitude);
        if (riderLat == null || riderLng == null) return null;
        return {
          id: rider.id,
          currentLat: riderLat,
          currentLng: riderLng,
          vehicleType: rider.vehicleType,
          ratingAvg: Number(rider.ratingAvg),
          distanceKm: haversineKm(lat, lng, riderLat, riderLng),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { success: true as const, riders: nearby };
  }
}
