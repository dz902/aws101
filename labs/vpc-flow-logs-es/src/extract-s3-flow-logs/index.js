console.log('Loading function');

const zlib = require('zlib');
const aws = require('aws-sdk');

const s3 = new aws.S3({ apiVersion: '2006-03-01' });

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2))

    // Get the object from the event and show its content type

    const params = extractS3BucketAndFileNames(event.Records[0].s3)

    try {
        const { Body, ContentType } = await s3.getObject(params).promise()
        
        const logEntries = extractLogEntries(Body)
        
        //console.log(logEntries)
        
        const result = await putRecordsToFirehose(logEntries).promise()
        
        console.log('Received result:', JSON.stringify(result))

        return result;
    } catch (err) {
        console.log(err);

        const message = `Error getting object ${params.Key} from bucket ${params.Bucket}. Make sure they exist and your bucket is in the same region as this function.`;
        console.log(message);

        throw new Error(message);
    }
};

function putRecordsToFirehose(records) {
    const firehose = new aws.Firehose();
    
    records = records.map(r => ({
        Data: JSON.stringify(r)
    }));
    
    var params = {
        Records: records,
        DeliveryStreamName: 'vpc-flow-logs-queue'
    };

    return firehose.putRecordBatch(params)
}

function extractLogEntries(gzippedData) {
    const decompressed = zlib.gunzipSync(gzippedData)
    const logEntries = Buffer.from(decompressed).toString().split(/[\n\r]+/).filter(x => x != '')
    
    logEntries.shift() // remove heading
    
    const formattedLogEntries = formatLogEntries(logEntries)
    
    return formattedLogEntries
}

function formatLogEntries(logEntries) {
    return logEntries.map(entry => {
        const fields = entry.split(' ')
        
        return {
            'version': Number(fields[0]),
            'account-id': Number(fields[1]),
            'interface-id': fields[2],
            'srcaddr': fields[3],
            'dstaddr': fields[4],
            'srcport': Number(fields[5]),
            'dstport': Number(fields[6]),
            'protocol': fields[7],
            'packets': Number(fields[8]),
            'bytes': Number(fields[9]),
            'start': Number(fields[10]),
            'end': Number(fields[11]),
            'action': fields[12],
            'log-status': fields[13]
        }
    })
}

function extractS3BucketAndFileNames(s3) {
    const bucket = s3.bucket.name
    const key = processS3ObjectKey(s3.object.key)

    return {
        Bucket: bucket,
        Key: key
    }
}

function processS3ObjectKey(key) {
    return decodeURIComponent(key.replace(/\+/g, ' '))
} 