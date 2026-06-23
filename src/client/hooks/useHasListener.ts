import { computed, ComputedRef, getCurrentInstance } from 'vue'

export function useHasListener<
  T extends (...args: any) => any,
  K extends string = Parameters<T>[number]
>(name: K): ComputedRef<boolean> {
  const instance = getCurrentInstance()!
  const key = `on${name[0].toUpperCase()}${name.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`

  return computed(() => !!instance.vnode.props?.[key])
}
