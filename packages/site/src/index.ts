export * from "./types";
export * from "./utils";
import { ISiteMetadata } from "./types";
import BittorrentSite from "./schema/AbstractBittorrentSite";
import PrivateSite from "./schema/AbstractPrivateSite";
export { BittorrentSite, PrivateSite };

const schemaContent = require.context("./schema/", false, /\.ts$/, "eager");
const definitionContent = require.context("./definitions/", false, /\.ts$/);

function transContent(value: string) {
  return value.replace(/^\.\//, "").replace(/\.ts$/, "");
}

export const schemaList = schemaContent.keys().map(transContent);
export const definitionList = definitionContent.keys().map(transContent);

export type TSite = PrivateSite | BittorrentSite;

export async function getSchemaModule(
  schema: string
): Promise<{ default: TSite }> {
  return await schemaContent(`./${schema}.ts`);
}

export async function getDefinitionModule(definition: string): Promise<{
  default?: TSite;
  siteMetadata: ISiteMetadata;
}> {
  return await definitionContent(`./${definition}.ts`);
}

const siteInstanceCache: Record<string, TSite> = {};

// FIXME 部分用户自定义的站点（此时在 js/site 目录中不存在对应模块），不能进行 dynamicImport 的情况，对此应该直接从 schema 中导入
export async function getSite(
  siteName: string,
  userConfig: Partial<ISiteMetadata> = {}
): Promise<TSite> {
  if (typeof siteInstanceCache[siteName] === "undefined") {
    // eslint-disable-next-line prefer-const
    let { siteMetadata: siteMetaData /* use as const */, default: SiteClass } =
      await getDefinitionModule(siteName);
    if (!siteMetaData.schema) {
      siteMetaData.schema =
        siteMetaData.type === "private"
          ? "AbstractPrivateSite"
          : "AbstractBittorrentSite";
    }

    /**
     * 如果该模块没有导出 default class，那么我们认为我们需要从基类继承
     * 并覆写基类的的 siteMetaData 信息
     */
    if (!SiteClass) {
      const schemaModule = await getSchemaModule(siteMetaData.schema);
      SiteClass = schemaModule.default;
    }

    // @ts-ignore
    siteInstanceCache[siteName] = new SiteClass(userConfig, siteMetaData);
  }

  return siteInstanceCache[siteName];
}
