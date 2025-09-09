// Utility type to mark a function as a client component function
export type ClientAction<T extends (...args: any[]) => any> = T & {
  __clientComponent?: never;
};
