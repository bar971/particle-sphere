export type Vec3 = [number, number, number];
export interface SpherePosition { latitudeDeg: number; longitudeDeg: number }

export function latLngToCartesian({ latitudeDeg, longitudeDeg }: SpherePosition, radius = 1): Vec3 {
  const lat = latitudeDeg * Math.PI / 180;
  const lng = longitudeDeg * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lng), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lng)];
}

export function distributeOnSphere(count: number): SpherePosition[] {
  if (count <= 0) return [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - 2 * (i + .5) / count;
    return { latitudeDeg: Math.asin(y) * 180 / Math.PI, longitudeDeg: ((i * golden * 180 / Math.PI + 180) % 360) - 180 };
  });
}

export function rotatePoint([x, y, z]: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
  return [x1, cp * y - sp * z1, sp * y + cp * z1];
}

export interface Projection { x: number; y: number; depth: number; visible: boolean; edge: number; scale: number }
export function projectPoint(point: Vec3, width: number, height: number, cameraZ = 3.2): Projection {
  const distance = cameraZ - point[2];
  const focal = Math.min(width, height) * 1.08;
  const x = width / 2 + point[0] * focal / distance;
  const y = height / 2 - point[1] * focal / distance;
  const radial = Math.hypot(point[0], point[1]);
  const visible = point[2] > -0.08;
  return { x, y, depth: point[2], visible, edge: Math.max(0, Math.min(1, (1 - radial) / .22)), scale: .78 + Math.max(0, point[2]) * .32 };
}
