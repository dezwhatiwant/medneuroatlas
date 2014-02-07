function Ontology (sig)
{
    var db,
        dbName    = 'medneuroatlas',
        dbVersion = 1,
        // {conceptId: 'FMA123', description: 'organ name'}
        isA       = [],
        partOf    = [];

    function loadSearchablePartsList (arrayName, fileName)
    {
        $.get ('data/' + fileName + '.txt', function (data)
        {
            var lines = data.split ('\n');

            for (var i = 1; i < lines.length; i++)
            {
                var fields = lines[i].split ('\t');
                if (fields.length === 3)
                    arrayName.push ({ conceptId: fields[0], description: fields[2] });
            }
        });
    }

    function loadPartsList (db, storeName)
    {
        $.get ('data/' + storeName + '.txt', function (data)
        {
            var lines = data.split ('\n');

            var trx = db.transaction ([storeName], 'readwrite');
            var objectStore = trx.objectStore (storeName);

            for (var i = 1; i < lines.length; i++)
            {
                var fields = lines[i].split ('\t');
                if (fields.length === 3)
                objectStore.add ({ conceptId: fields[0], representationId: fields[1], description: fields[2] });
            }
        });
    }

    function loadInclusionRelationList (db, storeName)
    {
        $.get ('data/' + storeName + '.txt', function (data)
        {
            var lines = data.split ('\n');

            var trx = db.transaction ([storeName], 'readwrite');
            var objectStore = trx.objectStore (storeName);

            for (var i = 1; i < lines.length; i++)
            {
                var fields = lines[i].split ('\t');
                if (fields.length === 4)
                objectStore.add ({ parentId: fields[0], childId: fields[3] });
            }
        });
    }

    function loadElementParts (db, storeName)
    {
        $.get ('data/' + storeName + '.txt', function (data)
        {
            var lines = data.split ('\n');

            var trx = db.transaction ([storeName], 'readwrite');
            var objectStore = trx.objectStore (storeName);

            // groupBy conceptId
            var id, fileIds = [];
            for (var i = 1; i < lines.length; i++)
            {
                var fields = lines[i].split ('\t');
                if (fields.length !== 3)
                    continue;

                if (id && id !== fields[0])
                {
                    objectStore.add ({ conceptId: id, elementFileIds: fileIds });
                    fileIds = [];
                }

                id = fields[0];
                fileIds.push (fields[2]);
            }
            objectStore.add ({ conceptId: id, elementFileIds: fileIds });
        });
    }

    this.search = function (str)
    {
        var li         = [],
            count      = 0,
            foundCount = 0;
        const limit = 10;

        $('#search').prop ('disabled', true);

        for (var i = 0; i < isA.length; i++)
        {
            var record = isA[i];
            if (record.description.indexOf (str) !== -1)
            {
                foundCount++;
                li.push ('<li data-concept="' + record.conceptId + '" data-flag="isA">' + record.description + '</li>');
            }

            if (foundCount >= limit)
                break;
        }

        foundCount = 0;
        for (var i = 0; i < partOf.length; i++)
        {
            var record = partOf[i];
            if (record.description.indexOf (str) !== -1)
            {
                foundCount++;
                li.push ('<li data-concept="' + record.conceptId + '" data-flag="partOf">' + record.description + '</li>');
            }

            if (foundCount >= limit)
                break;
        }

        $('#search-result').html (li.join (''));
        $('#search-result li:first-child').addClass ('ui-selected');
        $('#search').prop ('disabled', false);
    };
    
    this.getIsAElementFileIds = function (conceptId)
    {
        var request = db.transaction ('isa_element_parts').objectStore ('isa_element_parts').get (conceptId);
        request.onsuccess = function (evnt)
        {
            sig.dataRetrieved.dispatch (evnt.target.result.elementFileIds);
        };
    };

    this.getPartOfElementFileIds = function (conceptId)
    {
        var request = db.transaction ('partof_element_parts').objectStore ('partof_element_parts').get (conceptId);
        request.onsuccess = function (evnt)
        {
            sig.dataRetrieved.dispatch (evnt.target.result.elementFileIds);
        };
    };

    (function init ()
    {
        loadSearchablePartsList (isA,    'isa_parts_list_e');
        loadSearchablePartsList (partOf, 'partof_parts_list_e');

        indexedDB.deleteDatabase (dbName); // while testing reload each time

        var request = indexedDB.open (dbName, dbVersion);

        request.onsuccess = function (evnt)
        {
            db = evnt.target.result;
        }

        request.onupgradeneeded = function (evnt)
        {
            var db = evnt.target.result;
            var objectStore;

            ['isa_parts_list_e', 'partof_parts_list_e'].forEach (function (storeName)
            {
                objectStore = db.createObjectStore (storeName, { keyPath: 'conceptId' });
                objectStore.createIndex ('representationId', 'representationId', { unique: true });
            });

            ['isa_inclusion_relation_list', 'partof_inclusion_relation_list'].forEach (function (storeName)
            {
                objectStore = db.createObjectStore (storeName, { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex ('parentId', 'parentId', { unique: false });
                objectStore.createIndex ('childId',  'childId',  { unique: false });
            });


            ['isa_element_parts', 'partof_element_parts'].forEach (function (storeName)
            {
                objectStore = db.createObjectStore (storeName, { keyPath: 'conceptId' });
                objectStore.createIndex ('elementFileIds', 'elementFileIds', { unique: false });
            });

            objectStore.transaction.oncomplete = function (evnt)
            {
                ['isa_parts_list_e', 'partof_parts_list_e'].forEach (function (storeName)
                {
                    loadPartsList (db, storeName);
                });

                ['isa_inclusion_relation_list', 'partof_inclusion_relation_list'].forEach (function (storeName)
                {
                    loadInclusionRelationList (db, storeName);
                });


                ['isa_element_parts', 'partof_element_parts'].forEach (function (storeName)
                {
                    loadElementParts (db, storeName);
                });
            };
        }
    }) ();
}