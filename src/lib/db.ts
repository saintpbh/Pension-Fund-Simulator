import mssql from 'mssql';

const config: mssql.config = {
  server: process.env.DB_SERVER || 'mssql.nskorea.com',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'prok.or.kr',
  password: process.env.DB_PASSWORD || 'qp1f]4jIM',
  database: process.env.DB_DATABASE || 'KJ_CHURCH',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise: Promise<mssql.ConnectionPool> | null = null;

export async function getDbConnection(): Promise<mssql.ConnectionPool> {
  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = new mssql.ConnectionPool(config)
    .connect()
    .then((pool) => {
      console.log('Connected to MS SQL Server successfully.');
      return pool;
    })
    .catch((err) => {
      console.error('Database Connection Failed! - ', err);
      poolPromise = null;
      throw err;
    });

  return poolPromise;
}

export async function query<T = any>(sql: string, params: { name: string; type: any; value: any }[] = []): Promise<mssql.IResult<T>> {
  const pool = await getDbConnection();
  const request = pool.request();
  
  for (const param of params) {
    request.input(param.name, param.type, param.value);
  }
  
  return request.query<T>(sql);
}
