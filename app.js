

var mysql      = require('mysql');



class DbConnection
{
	constructor()
	{
		this.connection = mysql.createConnection({
			host     : '127.0.0.1',
			user     : 'root',
			password : 'asdf',
			database : 'pos'
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


let databaseName = 'pos';
let db = new DbConnection();
db.query('SHOW TABLES').then((response)=>
{
	console.log( response.result );

		//
	return response.result.map((i)=>i.Tables_in_pos);
})
.then((result)=>
{
	//console.log('result is',result);
	let promises = [];

	result.forEach((table_name)=>
	{
		let sql = 'SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA="'+databaseName+'" AND TABLE_NAME="'+table_name+'" AND REFERENCED_COLUMN_NAME IS NOT NULL';
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
		i.result.forEach((i)=>
		{
			if( !schemas[i.TABLE_NAME ] )
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

				schemas[ i.TABLE_NAME ] = {
					fields		: [],
					references	: {
					}
				};
			}
			schemas[ i.TABLE_NAME ].fields.push( i.COLUMN_NAME );
			if( i.REFERENCED_TABLE_SCHEMA )
			{
				schemas[i.TABLE_NAME].references[ i.REFERENCED_TABLE_NAME  ] = 1;
			}

		});
		//console.log('fields', i.fields);
	});

	console.log( schemas );
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
			console.log('FOOOO', j );
		});
	}

	console.log( s );


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


