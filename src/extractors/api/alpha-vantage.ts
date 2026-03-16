import { injectable } from 'tsyringe';
import { BaseApiExtractor } from './base';
import { Result, FinancialRecord, SourceType, ExtractionContext, ok, err } from '../../core/types';
import { ExtractionError } from '../../core/errors';
import { getConfig } from '../../config';

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

interface AlphaVantageTimeSeriesEntry {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

/** Extracts stock/market data from Alpha Vantage API */
@injectable()
export class AlphaVantageExtractor extends BaseApiExtractor {
  constructor() {
    super(5); // 5 requests per minute (free tier)
  }

  supports(sourceType: string): boolean {
    return sourceType === SourceType.API_ALPHA_VANTAGE;
  }

  /** Fetch stock time series data from Alpha Vantage */
  protected async fetchData(context: ExtractionContext): Promise<Result<unknown>> {
    const config = context.rawData as { symbol: string };
    if (!config.symbol) {
      return err(new ExtractionError('Symbol is required for Alpha Vantage', 'alpha_vantage'));
    }

    const apiKey = getConfig().ALPHA_VANTAGE_API_KEY;
    const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(config.symbol)}&apikey=${apiKey}&outputsize=compact`;

    const response = await fetch(url);
    if (!response.ok) {
      return err(
        new ExtractionError(`Alpha Vantage API returned ${response.status}`, 'alpha_vantage')
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data['Error Message']) {
      return err(
        new ExtractionError(`Alpha Vantage error: ${data['Error Message']}`, 'alpha_vantage')
      );
    }

    return ok(data);
  }

  /** Normalise Alpha Vantage response to FinancialRecord format */
  protected async normalise(rawData: unknown): Promise<Result<FinancialRecord>> {
    try {
      const data = rawData as Record<string, unknown>;
      const metaData = data['Meta Data'] as Record<string, string>;
      const timeSeries = data['Time Series (Daily)'] as Record<
        string,
        AlphaVantageTimeSeriesEntry
      >;

      if (!metaData || !timeSeries) {
        return err(
          new ExtractionError('Unexpected Alpha Vantage response structure', 'alpha_vantage')
        );
      }

      const symbol = metaData['2. Symbol'];
      const dates = Object.keys(timeSeries).sort();
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      const firstEntry = timeSeries[firstDate];
      const lastEntry = timeSeries[lastDate];

      const transactions = dates.map((date) => {
        const entry = timeSeries[date];
        const close = parseFloat(entry['4. close']);
        const open = parseFloat(entry['1. open']);
        const change = close - open;

        return {
          date,
          description: `${symbol} daily close`,
          amount: Math.abs(change),
          type: change >= 0 ? ('credit' as const) : ('debit' as const),
          category: 'market_data',
        };
      });

      const record: FinancialRecord = {
        accountHolderName: 'Market Data',
        accountNumberMasked: `XXXX-${symbol}`,
        institution: 'Alpha Vantage',
        periodStart: firstDate,
        periodEnd: lastDate,
        openingBalance: parseFloat(firstEntry['1. open']),
        closingBalance: parseFloat(lastEntry['4. close']),
        currency: 'USD',
        transactions,
      };

      return ok(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown normalisation error';
      return err(
        new ExtractionError(`Failed to normalise Alpha Vantage data: ${message}`, 'alpha_vantage')
      );
    }
  }
}
