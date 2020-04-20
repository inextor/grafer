var mysql		= require('mysql');

function resolveAll( object )
{
	var promises	= [];
	var index		= [];

	for( var i in object )
	{
		index.push( i );
		promises.push( object[ i ] );
	}

	return Promise.all( promises ).then
	(
	 	(values)=>
		{
			var obj = {};
			for(var i=0;i<values.length;i++)
			{
				obj[ index[ i ] ] = values [ i ];
			}

			return obj;
		}
	);
}
class DbConnection
{
	constructor(host,user,password,database)
	{
		this.connection = mysql.createConnection({
			host,
			user,
			password,
			database
		});

		this.connection.connect();
	}
	query(sql)
	{
		return new Promise((resolve,reject)=>
		{
			this.connection.query(sql, function (error, result, fields) {
				if( error )
				{
					reject( error );
					return;
				}
				resolve({result: result,fields:fields});
			});
		});
	}
	end()
	{
		this.connection.end();
	}
}

if( process.argv.length !== 6 )
{
	console.error('Usage:\nnnode app.js host user password database');
	//constructor(host,user,password,database)
}
else
{
	let databaseName = process.argv[5];
	let db = new DbConnection(process.argv[2],process.argv[3],process.argv[4],process.argv[5]);

	db.query('SHOW TABLES').then((response)=>
	{
		return response.result.map((i)=>i['Tables_in_'+databaseName]);
	})
	.then((tables)=>
	{
		let schemas = {};
		tables.forEach((table_name)=>
		{
			schemas[ table_name ] = {
				table_name	: table_name,
				fields		: [],
				references	: {}
			}
		});
		return Promise.resolve( schemas );
	})
	.then((schemas)=>
	{
		let promises = [];
		let describes = {

		};

		for(let i in schemas )
		{
			describes[ i ] = db.query('describe '+i);
		};
		return resolveAll({schemas: schemas,fields: resolveAll( describes )  });
	})
	.then((result)=>
	{
		let schemas = result.schemas;

		for(let i in result.fields )
		{
			result.fields[i].result.forEach((j)=>
			{

				if( schemas[i].fields.find(k=> k == j.Field) == undefined )
					schemas[i].fields.push( j.Field );
			});
		}
		return Promise.resolve( schemas );
	})
	.then((schemas)=>
	{
		let promises = {};

		for(let table_name in schemas )
		{
			let sql = 'SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA="'+databaseName+'" AND TABLE_NAME="'+table_name+'"'; // AND REFERENCED_COLUMN_NAME IS NOT NULL
			promises[table_name] = db.query( sql );
		}


		return resolveAll({schemas:Promise.resolve(schemas), references: resolveAll( promises )});

	})
	.then((results)=>
	{
		let schemas = results.schemas;

		for(let i in results.references)
		{

			let references = results.references[i].result;

			references.forEach((j)=>
			{
			/*    CONSTRAINT_CATALOG: 'def',
	    CONSTRAINT_SCHEMA: 'pos',
	    CONSTRAINT_NAME: 'stock_ibfk_1',
	    TABLE_CATALOG: 'def',
	    TABLE_SCHEMA: 'pos',
	    TABLE_NAME: 'stock',
	    COLUMN_NAME: 'item_id',
	    ORDINAL_POSITION: 1,
	    POSITION_IN_UNIQUE_CONSTRAINT: 1,
	    REFERENCED_TABLE_SCHEMA: 'pos',
	    REFERENCED_TABLE_NAME: 'item',
	    REFERENCED_COLUMN_NAME: 'id'
		*/
				//schemas[ j.TABLE_NAME ].fields.push( j.COLUMN_NAME );
				if( j.REFERENCED_TABLE_SCHEMA )
				{
					schemas[j.TABLE_NAME].references[ j.REFERENCED_TABLE_NAME  ] = 1;
				}
			});

			//i.fields.forEach((j)=>
			//{
			//});
		}

		let s =  '';

		for(let i in schemas )
		{
			let fields = schemas[i].fields;
			let f = [];
			f.push( ...fields );
			s += `${i} [shape=record label="{${i} | ${f.join('\\n')}}"];\n`

		}

		for(let i in schemas )
		{
			let keys = Object.keys( schemas[i].references );

			keys.forEach((j)=>
			{
				s += j+'->'+i+';\n';
			});
		}

		console.log( `digraph G {
			${s}
		}`);
		db.end();
	})
	.catch((error)=>
	{
		console.error( error );
		db.end();
	});
}

