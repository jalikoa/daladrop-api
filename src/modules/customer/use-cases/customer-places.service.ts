import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PutSavedPlacesDto } from '../dto/saved-places.dto';

export interface SavedPlaceView {
  readonly id: string;
  readonly label: string;
  readonly icon: string | null;
  readonly address: string;
  readonly pinned: boolean;
}

@Injectable()
export class CustomerPlacesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(userId: string): Promise<{
    success: true;
    places: SavedPlaceView[];
  }> {
    const places = await this.prisma.savedPlace.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ pinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        label: true,
        icon: true,
        address: true,
        pinned: true,
      },
    });
    return { success: true, places };
  }

  public async replace(
    userId: string,
    input: PutSavedPlacesDto,
  ): Promise<{ success: true; places: SavedPlaceView[] }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.savedPlace.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (input.places.length === 0) return;
      await tx.savedPlace.createMany({
        data: input.places.map((place, index) => ({
          userId,
          label: place.label.trim(),
          address: place.address.trim(),
          icon: place.icon?.trim() || null,
          pinned: place.pinned ?? false,
          sortOrder: index,
        })),
      });
    });
    return this.list(userId);
  }
}
