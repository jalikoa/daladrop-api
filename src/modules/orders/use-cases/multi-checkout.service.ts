import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  ModuleOrderStatus,
  ModuleType,
  PaymentStatus,
  StoreType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kes, kesToBigInt, type Money } from '../../../shared/money';
import { AgeVerificationService } from '../../compliance/use-cases/age-verification.service';
import { DeliveryQuoteService } from '../../logistics/use-cases/delivery-quote.service';
import { QuoteEngineService } from '../../logistics/use-cases/quote-engine.service';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  resolveDeliveryCoordinates,
  type CheckoutLineDto,
  type MultiCheckoutDto,
  type VendorOrderDto,
} from '../dto/orders.dto';
import { OrdersPaymentHelper } from '../helpers/orders-payment.helper';
import { PaymentsService } from '../../payments/use-cases/payments.service';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPPORT', 'FINANCE']);

@Injectable()
export class MultiCheckoutService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: DeliveryQuoteService,
    private readonly quoteEngine: QuoteEngineService,
    private readonly ageVerification: AgeVerificationService,
    private readonly payments: PaymentsService,
    private readonly paymentHelper: OrdersPaymentHelper,
    private readonly events: EventEmitter2,
  ) {}

  public async place(
    moduleType: ModuleType,
    actor: AuthPrincipalView,
    body: MultiCheckoutDto,
  ) {
    this.assertActor(actor, body.customerId);

    const { lat, lng } = resolveDeliveryCoordinates(body);
    if (lat == null || lng == null) {
      throw new BadRequestException(
        'lat/lng or deliveryLat/deliveryLng is required',
      );
    }

    if (moduleType === ModuleType.LIQUOR) {
      await this.assertAgeVerified(body.customerId);
    }

    const storeType = this.storeTypeForModule(moduleType);
    const vendorType = this.vendorTypeForModule(moduleType);

    const prepared: Array<{
      store: { id: string };
      lines: Array<{
        productId: string | null;
        menuItemId: string | null;
        nameSnapshot: string;
        unitPriceAmount: number;
        quantity: number;
        lineTotalAmount: number;
        notes: string | null;
        modifierOptionIds: string[];
        modifiersSnapshot: unknown;
        imageUrl: string | null;
      }>;
      subtotal: Money;
      deliveryFee: Money;
      serviceFee: Money;
      total: Money;
      riderPay: Money;
      platformCommission: Money;
      distanceKm: number | null;
      deliveryPricingRuleId: string | null;
      deliveryConstraintId: string | null;
      pricingQuoteId: string;
      notes: string | null;
    }> = [];
    const storeIds: string[] = [];
    for (const vendorOrder of body.orders) {
      const storeId = this.resolveVendorId(vendorOrder, moduleType);
      storeIds.push(storeId);
    }
    const stores = await this.prisma.store.findMany({
      where: {
        id: { in: storeIds },
        storeType,
        deletedAt: null,
        isActive: true,
      },
    });
    const storeById = new Map(stores.map((store) => [store.id, store]));

    for (const vendorOrder of body.orders) {
      const storeId = this.resolveVendorId(vendorOrder, moduleType);
      const store = storeById.get(storeId);
      if (!store) {
        throw new NotFoundException(`Store not found for vendor ${storeId}`);
      }

      const lines = await this.resolveLines(moduleType, store.id, vendorOrder.items);
      const subtotal = lines.reduce(
        (sum, line) => sum.add(kes(line.lineTotalAmount)),
        kes(0),
      );

      let cylinderTypeId: string | null = null;
      if (moduleType === ModuleType.GAS) {
        cylinderTypeId = await this.resolveGasCylinderTypeId(
          store.id,
          vendorOrder.items,
        );
      }

      const pricing = await this.resolveCheckoutPricing({
        quoteId: vendorOrder.quoteId,
        customerId: body.customerId,
        vendorType,
        vendorId: store.id,
        deliveryLat: lat,
        deliveryLng: lng,
        cylinderTypeId,
        subtotal,
      });

      prepared.push({
        store,
        lines,
        subtotal,
        deliveryFee: pricing.deliveryFee,
        serviceFee: pricing.serviceFee,
        total: pricing.total,
        riderPay: pricing.riderPay,
        platformCommission: pricing.platformCommission,
        distanceKm: pricing.distanceKm,
        deliveryPricingRuleId: pricing.deliveryPricingRuleId,
        deliveryConstraintId: pricing.deliveryConstraintId,
        pricingQuoteId: pricing.pricingQuoteId,
        notes: vendorOrder.notes ?? body.notes ?? null,
      });
    }

    const orderIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const prep of prepared) {
        const order = await tx.order.create({
          data: {
            moduleType,
            status: ModuleOrderStatus.PENDING_PAYMENT,
            customerId: body.customerId,
            storeId: prep.store.id,
            deliveryAddress: body.deliveryAddress ?? null,
            deliveryLatitude: lat,
            deliveryLongitude: lng,
            notes: prep.notes,
            subtotalAmount: kesToBigInt(prep.subtotal),
            deliveryFeeAmount: kesToBigInt(prep.deliveryFee),
            serviceFeeAmount: kesToBigInt(prep.serviceFee),
            totalAmount: kesToBigInt(prep.total),
            currency: 'KES',
            paymentStatus: PaymentStatus.PENDING,
            distanceKm: prep.distanceKm,
            deliveryPricingRuleId: prep.deliveryPricingRuleId,
            deliveryConstraintId: prep.deliveryConstraintId,
            riderPayAmount: kesToBigInt(prep.riderPay),
            platformCommissionAmount: kesToBigInt(prep.platformCommission),
            pricingQuoteId: prep.pricingQuoteId,
            createdBy: actor.id,
            items: {
              create: prep.lines.map((line) => ({
                productId: line.productId,
                menuItemId: line.menuItemId,
                nameSnapshot: line.nameSnapshot,
                unitPriceAmount: BigInt(line.unitPriceAmount),
                quantity: line.quantity,
                lineTotalAmount: BigInt(line.lineTotalAmount),
                currency: 'KES',
                notes: line.notes,
                modifierOptionIds: line.modifierOptionIds,
                modifiersSnapshot: line.modifiersSnapshot ?? undefined,
                imageUrl: line.imageUrl,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: ModuleOrderStatus.PENDING_PAYMENT,
                actorType: ActorType.USER,
                actorId: actor.id,
                reason: 'Order placed via multi-checkout',
              },
            },
          },
        });
        await this.quoteEngine.markConsumed(prep.pricingQuoteId, tx);
        orderIds.push(order.id);
      }
    });

    this.events.emit('orders.placed', {
      orderIds,
      customerId: body.customerId,
      moduleType,
    });

    let checkoutRequestId: string | null = null;
    let mpesaInitiated = false;

    const phone = body.mpesaPhone ?? body.phone;
    if (
      orderIds.length === 1 &&
      phone &&
      this.paymentHelper.stkOnPlaceEnabled()
    ) {
      const payResult = await this.initiateOrderPayment(
        orderIds[0]!,
        body.customerId,
        phone,
      );
      checkoutRequestId = payResult.checkoutRequestId;
      mpesaInitiated = payResult.initiated;
    }

    return {
      success: true as const,
      orderIds,
      checkoutRequestId,
      mpesa: { initiated: mpesaInitiated },
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  public async initiateOrderPayment(
    orderId: string,
    customerId: string,
    phoneRaw: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) {
      throw new ForbiddenException('Cannot pay for another user order');
    }
    if (
      order.status === ModuleOrderStatus.PAID ||
      order.paymentStatus === PaymentStatus.SUCCESS
    ) {
      return {
        initiated: false,
        checkoutRequestId: null as string | null,
        paymentId: null as string | null,
      };
    }
    // Food UX: the vendor may accept the order before the customer pays
    // (e.g. restaurant confirms availability first), so ACCEPTED orders
    // remain payable as long as payment has not already succeeded.
    const payableStatuses = new Set<ModuleOrderStatus>([
      ModuleOrderStatus.PENDING_PAYMENT,
      ModuleOrderStatus.ACCEPTED,
    ]);
    if (!payableStatuses.has(order.status)) {
      throw new BadRequestException(
        `Order cannot be paid in status ${order.status}`,
      );
    }

    const phone = this.paymentHelper.requirePhone(phoneRaw);
    const providerCode = this.paymentHelper.resolveProviderCode();
    const payment = await this.payments.createAndInitiate({
      customerId,
      amount: order.totalAmount,
      currency: order.currency,
      purpose: 'ORDER',
      providerCode,
      payerIdentifier: phone,
      description: `Order ${orderId}`,
      idempotencyKey: `order-pay:${orderId}:${providerCode}`,
      orderId,
      metadata: { source: 'orders.pay', orderId },
    });

    const initiated =
      providerCode !== 'MANUAL' &&
      Boolean(payment.checkoutRequestId) &&
      payment.status !== 'FAILED';

    if (providerCode !== 'MANUAL' && !initiated) {
      throw new BadRequestException(
        payment.failureMessage ?? 'Payment provider did not initiate STK',
      );
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.PROCESSING },
    });

    this.events.emit('orders.payment_requested', {
      orderId,
      paymentId: payment.id,
      customerId,
      checkoutRequestId: payment.checkoutRequestId ?? null,
    });

    return {
      initiated,
      checkoutRequestId: payment.checkoutRequestId ?? null,
      paymentId: payment.id,
    };
  }

  private assertActor(actor: AuthPrincipalView, customerId: string): void {
    const isAdmin = actor.roles.some((role) => ADMIN_ROLES.has(role));
    if (actor.id !== customerId && !isAdmin) {
      throw new ForbiddenException(
        'customerId must match the authenticated user',
      );
    }
  }

  private async assertAgeVerified(userId: string): Promise<void> {
    const status = await this.ageVerification.getStatus(userId);
    if (status.status !== 'verified') {
      throw new HttpException(
        {
          success: false,
          error: 'AGE_VERIFICATION_REQUIRED',
          code: 'AGE_VERIFICATION_REQUIRED',
          status: status.status,
        },
        423,
      );
    }
  }

  private vendorTypeForModule(moduleType: ModuleType): string {
    switch (moduleType) {
      case ModuleType.FOOD:
        return 'restaurant';
      case ModuleType.MARKET:
        return 'market';
      case ModuleType.LIQUOR:
        return 'liquor';
      case ModuleType.GAS:
        return 'gas';
      default:
        throw new BadRequestException(
          `Unsupported module type for checkout: ${moduleType}`,
        );
    }
  }

  private async resolveCheckoutPricing(input: {
    readonly quoteId?: string;
    readonly customerId: string;
    readonly vendorType: string;
    readonly vendorId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
    readonly cylinderTypeId: string | null;
    readonly subtotal: Money;
  }) {
    if (input.quoteId) {
      const quote = await this.quoteEngine.requireUsable(
        input.quoteId,
        input.customerId,
        {
          storeId: input.vendorId,
          deliveryLat: input.deliveryLat,
          deliveryLng: input.deliveryLng,
        },
      );
      if (quote.storeId && quote.storeId !== input.vendorId) {
        throw new BadRequestException('Quote does not match this vendor');
      }
      const breakdown =
        quote.breakdown && typeof quote.breakdown === 'object'
          ? (quote.breakdown as Record<string, unknown>)
          : {};
      const peakAmount = Number(quote.peakAmount ?? 0);
      return {
        pricingQuoteId: quote.id,
        deliveryFee: kes(Number(quote.deliveryFeeAmount)),
        serviceFee: kes(Number(quote.serviceFeeAmount)),
        total: kes(
          Math.max(
            0,
            input.subtotal.amount +
              Number(quote.deliveryFeeAmount) +
              Number(quote.serviceFeeAmount) +
              peakAmount -
              Number(quote.couponAmount) -
              Number(quote.walletCreditAmount),
          ),
        ),
        riderPay: kes(Number(quote.riderEarningsAmount)),
        platformCommission: kes(Number(quote.platformRevenueAmount)),
        distanceKm: quote.distanceKm != null ? Number(quote.distanceKm) : null,
        deliveryPricingRuleId: quote.deliveryPricingRuleId,
        deliveryConstraintId:
          typeof breakdown.constraintId === 'string'
            ? breakdown.constraintId
            : null,
      };
    }

    const persisted = await this.quoteEngine.quoteCheckout({
      customerId: input.customerId,
      vendorType: input.vendorType,
      vendorId: input.vendorId,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      cylinderTypeId: input.cylinderTypeId,
      subtotalAmount: input.subtotal.amount,
    });
    return {
      pricingQuoteId: persisted.quoteId,
      deliveryFee: kes(persisted.amounts.deliveryFee),
      serviceFee: kes(persisted.amounts.serviceFee),
      total: kes(persisted.amounts.total),
      riderPay: kes(persisted.earnings.rider),
      platformCommission: kes(persisted.amounts.platformFee),
      distanceKm: persisted.distanceKm,
      deliveryPricingRuleId: persisted.ruleId,
      deliveryConstraintId:
        persisted.breakdown &&
        typeof persisted.breakdown === 'object' &&
        typeof (persisted.breakdown as Record<string, unknown>).constraintId ===
          'string'
          ? ((persisted.breakdown as Record<string, unknown>)
              .constraintId as string)
          : null,
    };
  }

  private storeTypeForModule(moduleType: ModuleType): StoreType {
    switch (moduleType) {
      case ModuleType.FOOD:
        return StoreType.RESTAURANT;
      case ModuleType.MARKET:
        return StoreType.MARKET;
      case ModuleType.LIQUOR:
        return StoreType.LIQUOR;
      case ModuleType.GAS:
        return StoreType.GAS;
      default:
        throw new BadRequestException(
          `Unsupported module type for checkout: ${moduleType}`,
        );
    }
  }

  private resolveVendorId(
    vendor: VendorOrderDto,
    moduleType: ModuleType,
  ): string {
    const id =
      vendor.storeId ??
      vendor.restaurantId ??
      vendor.marketId ??
      vendor.liquorStoreId ??
      vendor.gasStoreId;
    if (!id) {
      throw new BadRequestException(
        `Vendor id required for ${moduleType} order (restaurantId/marketId/storeId)`,
      );
    }
    return id;
  }

  private async resolveLines(
    moduleType: ModuleType,
    storeId: string,
    items: CheckoutLineDto[],
  ) {
    if (moduleType === ModuleType.FOOD) {
      return this.resolveFoodLinesBatch(storeId, items);
    }
    return this.resolveProductLinesBatch(storeId, items);
  }

  private async resolveFoodLinesBatch(
    storeId: string,
    items: CheckoutLineDto[],
  ) {
    const menuItemIds = items.map((item) => item.menuItemId ?? item.id).filter(
      (id): id is string => Boolean(id),
    );
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        storeId,
        deletedAt: null,
        isAvailable: true,
      },
      include: {
        modifierGroups: { include: { options: true } },
      },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const lines = [];
    for (const item of items) {
      const menuItemId = item.menuItemId ?? item.id;
      if (!menuItemId) {
        throw new BadRequestException('menuItemId is required for food lines');
      }
      const menuItem = byId.get(menuItemId);
      if (!menuItem) {
        throw new BadRequestException(
          `Menu item ${menuItemId} is unavailable for this restaurant`,
        );
      }
      lines.push(this.buildFoodLine(menuItem, item));
    }
    return lines;
  }

  private buildFoodLine(
    menuItem: {
      id: string;
      name: string;
      priceAmount: unknown;
      imageUrl: string | null;
      modifierGroups: Array<{
        options: Array<{
          id: string;
          name: string;
          priceDelta: unknown;
          isAvailable: boolean;
        }>;
      }>;
    },
    item: CheckoutLineDto,
  ) {
    const optionIds = this.collectModifierOptionIds(item);
    let unitPrice: Money = kes(Number(menuItem.priceAmount));
    const modifiersSnapshot: { id: string; name: string; priceDelta: number }[] =
      [];

    if (optionIds.length > 0) {
      const optionsById = new Map(
        menuItem.modifierGroups.flatMap((group) =>
          group.options.map((opt) => [opt.id, opt] as const),
        ),
      );
      for (const optionId of optionIds) {
        const opt = optionsById.get(optionId);
        if (!opt || !opt.isAvailable) {
          throw new BadRequestException(
            `Modifier option ${optionId} is invalid for menu item`,
          );
        }
        unitPrice = unitPrice.add(kes(Number(opt.priceDelta)));
        modifiersSnapshot.push({
          id: opt.id,
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
        });
      }
    }

    const lineTotal = unitPrice.multiply(item.quantity);
    return {
      productId: null as string | null,
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      unitPriceAmount: unitPrice.amount,
      quantity: item.quantity,
      lineTotalAmount: lineTotal.amount,
      notes: item.notes ?? item.customizationNotes ?? null,
      modifierOptionIds: optionIds,
      modifiersSnapshot:
        modifiersSnapshot.length > 0 ? modifiersSnapshot : null,
      imageUrl: menuItem.imageUrl,
    };
  }

  private async resolveProductLinesBatch(
    storeId: string,
    items: CheckoutLineDto[],
  ) {
    const productIds = items
      .map((item) => item.productId ?? item.id)
      .filter((id): id is string => Boolean(id));
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId,
        deletedAt: null,
        isActive: true,
        inStock: true,
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = [];
    for (const item of items) {
      const productId = item.productId ?? item.id;
      if (!productId) {
        throw new BadRequestException('productId is required for product lines');
      }
      const product = byId.get(productId);
      if (!product) {
        throw new BadRequestException(
          `Product ${productId} is unavailable for this store`,
        );
      }
      const unitPrice = kes(Number(product.priceAmount));
      const lineTotal = unitPrice.multiply(item.quantity);
      lines.push({
        productId: product.id,
        menuItemId: null as string | null,
        nameSnapshot: product.name,
        unitPriceAmount: unitPrice.amount,
        quantity: item.quantity,
        lineTotalAmount: lineTotal.amount,
        notes: item.notes ?? item.customizationNotes ?? null,
        modifierOptionIds: [] as string[],
        modifiersSnapshot: null,
        imageUrl: product.imageUrl,
      });
    }
    return lines;
  }

  private async resolveFoodLine(storeId: string, item: CheckoutLineDto) {
    const [line] = await this.resolveFoodLinesBatch(storeId, [item]);
    return line;
  }

  private async resolveProductLine(storeId: string, item: CheckoutLineDto) {
    const [line] = await this.resolveProductLinesBatch(storeId, [item]);
    return line;
  }

  private collectModifierOptionIds(item: CheckoutLineDto): string[] {
    const fromArray = item.modifierOptionIds ?? [];
    const fromModifiers = (item.modifiers ?? [])
      .map((m) => m.optionId ?? m.id)
      .filter((id): id is string => Boolean(id));
    return [...new Set([...fromArray, ...fromModifiers])];
  }

  private async resolveGasCylinderTypeId(
    storeId: string,
    items: CheckoutLineDto[],
  ): Promise<string> {
    const productIds = items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));
    if (productIds.length === 0) {
      throw new BadRequestException('Gas checkout requires productId lines');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, storeId, deletedAt: null },
      select: { id: true, cylinderTypeId: true },
    });
    const cylinderIds = [
      ...new Set(
        products
          .map((p) => p.cylinderTypeId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (cylinderIds.length === 0) {
      throw new BadRequestException(
        'Gas products must have cylinderTypeId for delivery pricing',
      );
    }
    if (cylinderIds.length > 1) {
      throw new BadRequestException(
        'All gas line items in one vendor order must share the same cylinder type',
      );
    }
    return cylinderIds[0]!;
  }
}
