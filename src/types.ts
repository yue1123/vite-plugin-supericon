export interface IconDataItem {
  id: string
  /** font: CSS class;svg: <symbol> id。两者均为 `${prefix}-${id}` */
  useId: string
  /** 交付格式,由所属源目录决定 */
  format: 'font' | 'svg'
  svg: string
  svgBody: string
  /** 真实 viewBox,如 '0 0 24 24' */
  viewBox: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  /** 所属源目录下从外到内的每层目录名;根级图标为 [] */
  tags: string[]
}
export type IconData = IconDataItem[]

export type UpdatePayload = {
  name: string
  cssPath: string
  /** sprite.svg 磁盘绝对路径;无 svg 轨时为 undefined */
  spritePath?: string
  iconList: IconData
}
