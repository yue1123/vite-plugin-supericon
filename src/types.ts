export interface IconDataItem {
  id: string
  /** font: CSS class;svg: <symbol> id。两者均为 `${prefix}-${id}` */
  useId: string
  /** 交付格式,由所属源目录决定 */
  format: 'font' | 'svg'
  svg: string
  svgBody: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  /** 所属源目录下从外到内的每层目录名;根级图标为 [] */
  tags: string[]
  /** import 模式下的组件导出名(如 IconHome);仅 import 模式填充 */
  exportName?: string
}
export type IconData = IconDataItem[]

export type UpdatePayload = {
  name: string
  /** 消费模式,决定预览 UI 复制何种代码 */
  mode: 'class' | 'import'
  cssPath: string
  /** sprite.svg 磁盘绝对路径;无 svg 轨时为 undefined */
  spritePath?: string
  iconList: IconData
}
