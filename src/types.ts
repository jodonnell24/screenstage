export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type DemoModule = {
  default: (context: unknown) => Promise<void>;
};
