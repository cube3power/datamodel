import { rowDiffsetIterator } from './row-diffset-iterator';

/**
 * Creates bin f from the data and the supplied config.
 *
 * @param {Array} data - The input data.
 * @param {Object} config - The config object.
 * @param {number} config.binSize - The size of the bin.
 * @param {number} config.numOfBins - The number of bins to be created.
 * @return {Array} Returns an array of created bins.
 */
export function createBinnedFieldData (field, rowDiffset, config) {
    let { buckets, binCount, binSize, start } = config;
    let dataStore = [];
    let binnedData = [];
    let [min, max] = field.domain();
    let oriMax = max;
    let stops = [];
    let binEnd;
    let prevEndpoint;
    let mid;
    let range;

    // create dataStore with index according to rowDiffSet
    rowDiffsetIterator(rowDiffset, (i) => {
        dataStore.push({
            data: field.data[i],
            index: i
        });
    });

    // create buckets if buckets not given
    if (!buckets) {
        max += 1;
        binSize = binSize || (max - min) / binCount;

        const extraBinELm = (max - min) % binSize;
        if (!binCount && extraBinELm !== 0) {
            max = max + binSize - extraBinELm;
        }
        binEnd = min + binSize;
        while (binEnd <= max) {
            stops.push(binEnd);
            binEnd += binSize;
        }
        start = start || min;
        buckets = { start, stops };
    }

    // initialize intial bucket start
    prevEndpoint = buckets.start === 0 ? 0 : buckets.start || min;

    // mark each data in dataStore to respective buckets
    buckets.stops.forEach((endPoint) => {
        let tempStore = dataStore.filter(datum => datum.data >= prevEndpoint && datum.data < endPoint);
        tempStore.forEach((datum) => { binnedData[datum.index] = `${prevEndpoint}-${endPoint}`; });
        prevEndpoint = endPoint;
    });

    // create a bin for values less than start
    dataStore.filter(datum => datum.data < buckets.start)
                    .forEach((datum) => { binnedData[datum.index] = `${min}-${buckets.start}`; });

    // create a bin for values more than end
    dataStore.filter(datum => datum.data >= buckets.stops[buckets.stops.length - 1])
                    .forEach((datum) =>
                    { binnedData[datum.index] = `${buckets.stops[buckets.stops.length - 1]}-${oriMax}`; });

    // create range and mid
    // append start to bucket marks
    buckets.stops.unshift(buckets.start);
    range = new Set(buckets.stops);

    // Add endpoints to buckets marks if not added
    if (min < buckets.start) { range.add(min); }
    if (oriMax > buckets.stops[buckets.stops.length - 1]) { range.add(oriMax); }

    range = [...range].sort((a, b) => a - b);
    mid = [];

    for (let i = 1; i < range.length; i++) {
        mid.push((range[i - 1] + range[i]) / 2);
    }
    return { data: binnedData, mid, range };
}
