/**
 * Re-export shared haversine from merchants so logistics quotes stay consistent
 * with discovery distance displays.
 */
export {
  haversineKm,
  toNumber,
} from '../../merchants/domain/geo.util';
