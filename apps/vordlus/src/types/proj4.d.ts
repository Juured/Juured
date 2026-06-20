// proj4 ambient type
declare module "proj4" {
  type Coords = [number, number] | { x: number; y: number };
  const proj4: {
    defs(name: string, def: string): void;
    (from: string, to: string, coords: Coords | Coords[]): [number, number];
  };
  export default proj4;
}
