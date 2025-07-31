import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../core/logger';

export interface DownloadOptions {
  maxRedirects?: number;
  timeout?: number;
  headers?: Record<string, string>;
  proxy?: string;
}

/**
 * 检查字符串是否为空
 */
function isEmptyString(str?: string): boolean {
  return !str || str.trim().length === 0;
}

/**
 * 发送POST请求
 * @param api 请求URL
 * @param data 请求数据
 * @param headers 请求头
 * @param proxy 代理设置
 */
export function post(api: string, data: any, headers: any, proxy?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options: https.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        ...headers,
      },
    };

    if (proxy !== null && !isEmptyString(proxy)) {
      options.agent = new HttpsProxyAgent(proxy!);
    }

    const req = https
      .request(api, options, (res) => {
        if (res.statusCode === 200) {
          let result = '';
          res.on('data', (chunk) => {
            result += chunk;
          });

          res.on('end', () => {
            resolve(result);
          });
        } else {
          reject(new Error(`请求失败，状态码: ${res.statusCode}`));
        }
      })
      .on('error', (err) => {
        reject(err);
      });

    req.write(body);
    req.end();
  });
}

/**
 * 下载文件到指定路径（参考示例代码优化）
 * @param uri 下载地址
 * @param savepath 保存路径
 * @param proxy 代理设置
 */
export function downloadFile(uri: string, savepath: string, proxy?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {};
    if (proxy !== null && !isEmptyString(proxy)) {
      options.agent = new HttpsProxyAgent(proxy!);
    }

    const file = fs.createWriteStream(savepath);
    file.on('finish', () => {
      file.close();
      resolve();
    });

    https
      .get(uri, options, (res) => {
        if (res.statusCode === 200) {
          let intermediate: zlib.Gunzip | zlib.Inflate | undefined;
          const contentEncoding = res.headers['content-encoding'];

          if (contentEncoding === 'gzip') {
            intermediate = zlib.createGunzip();
          } else if (contentEncoding === 'deflate') {
            intermediate = zlib.createInflate();
          }

          if (intermediate) {
            res.pipe(intermediate).pipe(file);
          } else {
            res.pipe(file);
          }
        } else {
          reject(new Error(`下载失败，状态码: ${res.statusCode}`));
        }
      })
      .on('error', (err) => {
        // 关闭并删除临时文件
        file.close();
        if (fs.existsSync(savepath)) {
          try {
            fs.unlinkSync(savepath);
          } catch (unlinkError) {
            logger.warn(`删除临时文件失败: ${savepath}, ${unlinkError}`);
          }
        }
        reject(err);
      });
  });
}

/**
 * 高级下载文件功能（支持重定向、超时等）
 * @param uri 下载地址
 * @param savepath 保存路径
 * @param options 下载选项
 */
export async function downloadFileAdvanced(
  uri: string,
  savepath: string,
  options: DownloadOptions = {},
): Promise<void> {
  const { maxRedirects = 5, timeout = 30000, headers = {}, proxy } = options;

  logger.info(`开始下载文件: ${uri} -> ${savepath}`);

  return new Promise((resolve, reject) => {
    const downloadWithRedirect = (requestUrl: string, redirectCount: number = 0): void => {
      if (redirectCount >= maxRedirects) {
        reject(new Error(`重定向次数过多 (${maxRedirects})`));
        return;
      }

      const parsedUrl = new URL(requestUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const defaultHeaders = {
        'User-Agent': 'VSCode-Syncing/1.0.0',
        Accept: '*/*',
        ...headers,
      };

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: defaultHeaders,
      };

      if (proxy !== null && !isEmptyString(proxy)) {
        requestOptions.agent = new HttpsProxyAgent(proxy!);
      }

      const request = client.request(requestOptions, (response) => {
        const statusCode = response.statusCode || 0;

        logger.debug(`响应状态码: ${statusCode}`);

        if (statusCode === 200) {
          // 成功响应，开始下载
          const file = fs.createWriteStream(savepath);
          const contentLength = parseInt(response.headers['content-length'] || '0', 10);

          file.on('finish', () => {
            file.close();

            // 验证文件大小
            const stats = fs.statSync(savepath);
            const actualSize = stats.size;

            logger.info(`文件下载完成: ${savepath} (${actualSize} bytes)`);

            if (contentLength > 0 && actualSize !== contentLength) {
              logger.error(`文件大小不匹配: 期望 ${contentLength} bytes, 实际 ${actualSize} bytes`);
              if (fs.existsSync(savepath)) {
                fs.unlinkSync(savepath);
              }
              reject(
                new Error(`文件下载不完整: 期望 ${contentLength} bytes, 实际 ${actualSize} bytes`),
              );
              return;
            }

            resolve();
          });

          file.on('error', (error: Error) => {
            logger.error(`文件写入错误: ${error.message}`);
            file.close();
            if (fs.existsSync(savepath)) {
              fs.unlinkSync(savepath);
            }
            reject(error);
          });

          // 处理压缩内容
          let intermediate: zlib.Gunzip | zlib.Inflate | undefined;
          const contentEncoding = response.headers['content-encoding'];

          if (contentEncoding === 'gzip') {
            intermediate = zlib.createGunzip();
          } else if (contentEncoding === 'deflate') {
            intermediate = zlib.createInflate();
          }

          if (intermediate) {
            response.pipe(intermediate).pipe(file);
            intermediate.on('error', (error: Error) => {
              logger.error(`解压缩错误: ${error.message}`);
              file.close();
              if (fs.existsSync(savepath)) {
                fs.unlinkSync(savepath);
              }
              reject(error);
            });
          } else {
            response.pipe(file);
          }

          response.on('error', (error: Error) => {
            logger.error(`响应流错误: ${error.message}`);
            file.close();
            if (fs.existsSync(savepath)) {
              fs.unlinkSync(savepath);
            }
            reject(error);
          });
        } else if (
          statusCode === 301 ||
          statusCode === 302 ||
          statusCode === 307 ||
          statusCode === 308
        ) {
          // 处理重定向
          const redirectUrl = response.headers.location;
          if (redirectUrl !== undefined) {
            logger.info(`重定向到: ${redirectUrl} (${redirectCount + 1}/${maxRedirects})`);
            downloadWithRedirect(redirectUrl, redirectCount + 1);
          } else {
            reject(new Error('重定向但未提供新URL'));
          }
        } else {
          reject(new Error(`下载失败，状态码: ${statusCode}`));
        }
      });

      request.on('error', (error: Error) => {
        logger.error(`请求错误: ${error.message}`);
        reject(error);
      });

      // 设置超时
      request.setTimeout(timeout, () => {
        request.destroy();
        reject(new Error(`下载超时 (${timeout}ms)`));
      });

      request.end();
    };

    downloadWithRedirect(uri);
  });
}

/**
 * 下载扩展 VSIX 文件（优化版本）
 * @param extensionId 扩展ID (publisher.name)
 * @param version 版本号
 * @param savepath 保存路径
 */
export async function downloadExtensionVsix(
  extensionId: string,
  version: string,
  savepath: string,
): Promise<void> {
  const [publisher, name] = extensionId.split('.');
  if (!publisher || !name) {
    throw new Error(`无效的扩展ID格式: ${extensionId}`);
  }

  // 尝试多个可能的下载URL
  const downloadUrls = [
    `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${name}/${version}/vspackage`,
    `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`,
  ];

  logger.info(`下载扩展 VSIX: ${extensionId} v${version}`);

  let lastError: Error | null = null;

  for (const downloadUrl of downloadUrls) {
    try {
      logger.debug(`尝试下载URL: ${downloadUrl}`);

      await downloadFileAdvanced(downloadUrl, savepath, {
        maxRedirects: 10, // VSCode Marketplace 可能有多次重定向
        timeout: 120000, // 扩展文件可能较大，增加超时时间到2分钟
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': 'VSCode-Syncing/1.0.0',
        },
      });

      // 验证下载的文件是否为有效的VSIX文件
      if (fs.existsSync(savepath)) {
        const stats = fs.statSync(savepath);
        if (stats.size > 0) {
          logger.info(`扩展 VSIX 下载成功: ${extensionId} v${version} (${stats.size} bytes)`);
          return;
        } else {
          logger.warn(`下载的文件为空: ${savepath}`);
          fs.unlinkSync(savepath);
        }
      }
    } catch (error) {
      lastError = error as Error;
      logger.warn(`下载URL失败: ${downloadUrl}, 错误: ${lastError.message}`);

      // 清理可能存在的损坏文件
      if (fs.existsSync(savepath)) {
        fs.unlinkSync(savepath);
      }
    }
  }

  throw new Error(`所有下载URL都失败了，最后一个错误: ${lastError?.message || '未知错误'}`);
}
