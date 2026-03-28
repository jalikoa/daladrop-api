import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentSession } from '../payments/entities/payment-session.entity';
import { MerchantProfile } from '../merchants/entities/merchant-profile.entity';
import { User } from '../users/entities/user.entity';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { AdminDashboardStatsDto, RecentPaymentDto, MerchantOverviewDto } from './dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(PaymentSession)
    private paymentRepository: Repository<PaymentSession>,
    @InjectRepository(MerchantProfile)
    private merchantRepository: Repository<MerchantProfile>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * Get dashboard statistics for admin
   */
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total merchants count
    const totalMerchants = await this.merchantRepository.count();

    // Total users count (excluding admins)
    const totalUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.role != :role', { role: 'ADMIN' })
      .getCount();

    // Revenue and transactions today
    const todayStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'revenue')
      .addSelect('COUNT(payment.id)', 'transactions')
      .where('payment.created_at >= :today', { today })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    const revenueToday = parseFloat(todayStats?.revenue || '0');
    const transactionsToday = parseInt(todayStats?.transactions || '0', 10);

    // Success rate (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const last7DaysStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('COUNT(CASE WHEN payment.status = :completed THEN 1 END)', 'completed')
      .addSelect('COUNT(CASE WHEN payment.status IN (:...failed) THEN 1 END)', 'failed')
      .addSelect('COUNT(payment.id)', 'total')
      .where('payment.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .setParameter('completed', PaymentStatus.COMPLETED)
      .setParameter('failed', [PaymentStatus.FAILED, PaymentStatus.CANCELLED])
      .getRawOne();

    const totalTransactions = parseInt(last7DaysStats?.total || '0', 10);
    const completedTransactions = parseInt(last7DaysStats?.completed || '0', 10);
    const successRate = totalTransactions > 0
      ? parseFloat(((completedTransactions / totalTransactions) * 100).toFixed(2))
      : 0;

    return {
      totalMerchants,
      totalUsers,
      revenueToday,
      successRate,
      transactionsToday,
    };
  }

  /**
   * Get recent payments for admin dashboard
   */
  async getRecentPayments(limit: number = 5): Promise<RecentPaymentDto[]> {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.merchant', 'merchant')
      .select([
        'payment.id',
        'payment.amount',
        'payment.status',
        'payment.created_at',
        'merchant.business_name',
      ])
      .orderBy('payment.created_at', 'DESC')
      .limit(limit)
      .getRawMany();

    return payments.map((payment) => ({
      merchant: payment.merchant_business_name,
      amount: parseFloat(payment.payment_amount),
      status: payment.payment_status,
      date: this.formatDate(payment.payment_created_at),
    }));
  }

  /**
   * Get merchant overview for admin dashboard
   */
  async getMerchantOverview(): Promise<MerchantOverviewDto[]> {
    const merchants = await this.merchantRepository
      .createQueryBuilder('merchant')
      .leftJoin(
        '(SELECT merchant_id, SUM(amount) as total_revenue FROM payments.payment_sessions WHERE status = :completed GROUP BY merchant_id)',
        'revenue',
        'revenue.merchant_id = merchant.id',
      )
      .setParameter('completed', PaymentStatus.COMPLETED)
      .select([
        'merchant.id',
        'merchant.business_name',
        'merchant.status',
        'merchant.verification_status',
        'COALESCE(revenue.total_revenue, 0) as revenue',
      ])
      .orderBy('merchant.created_at', 'DESC')
      .limit(10)
      .getRawMany();

    return merchants.map((merchant) => ({
      id: parseInt(merchant.merchant_id, 10),
      name: merchant.merchant_business_name,
      status: merchant.merchant_status,
      verified: merchant.merchant_verification_status,
      revenue: parseFloat(merchant.revenue || '0'),
    }));
  }

  /**
   * Format date to "DD MMM HH:mm" format
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate().toString().padStart(2, '0');
    const month = months[d.getMonth()];
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${hours}:${minutes}`;
  }
}
