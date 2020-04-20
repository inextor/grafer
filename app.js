

var mysql      = require('mysql');



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
	.then((result)=>
	{
		let promises = [];
		//console.log('First result', result );

		result.forEach((table_name)=>
		{
			let sql = 'SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA="'+databaseName+'" AND TABLE_NAME="'+table_name+'" AND REFERENCED_COLUMN_NAME IS NOT NULL';
			//console.log('Sql',sql);
			promises.push( db.query( sql ) );
		});
		return Promise.all( promises );

	})
	.then((results)=>
	{
		let schemas = {
		};
		results.forEach((i)=>
		{

			//console.log('i',i.result);
			i.result.forEach((j)=>
			{
				//console.log( 'j' );
				//console.log( j.TABLE_NAME );

				if( !schemas[j.TABLE_NAME ] )
				{
					//console.log('if schemas ');
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

					schemas[ j.TABLE_NAME ] = {
						fields		: [],
						references	: {
						}
					};
				}
				schemas[ j.TABLE_NAME ].fields.push( j.COLUMN_NAME );
				if( j.REFERENCED_TABLE_SCHEMA )
				{
					//console.log('referenced table ');
					schemas[j.TABLE_NAME].references[ j.REFERENCED_TABLE_NAME  ] = 1;
				}
			});
		});

		let s =  '';

		for(let i in schemas )
		{
			let fields = schemas[i].fields;
			let f = [];
			f.push( ...fields );
			s += `${i} [shape=record label="{${i} | ${f.join('\\n')}}"];\n`
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
