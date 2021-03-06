var guidParse = require('./common/guid-parse');
var Long = require('long');
var ensure = require('./common/utils/ensure');

/**
 * @public
 * @param {!number|!Long} commitPosition
 * @param {!number|!Long} preparePosition
 * @constructor
 * @property {!Long} commitPosition
 * @property {!Long} preparePosition
 */
function Position(commitPosition, preparePosition) {
  ensure.notNull(commitPosition, "commitPosition");
  ensure.notNull(preparePosition, "preparePosition");
  this.commitPosition = Long.fromValue(commitPosition);
  this.preparePosition = Long.fromValue(preparePosition);
  Object.freeze(this);
}

Position.prototype.compareTo = function(other) {
  if (this.commitPosition.lt(other.commitPosition) || (this.commitPosition.eq(other.commitPosition)&& this.preparePosition.lt(other.preparePosition)))
    return -1;
  if (this.commitPosition.gt(other.commitPosition) || (this.commitPosition.eq(other.commitPosition) && this.preparePosition.gt(other.preparePosition)))
    return 1;
  return 0;
};

Position.prototype.toString = function() {
  return [this.commitPosition.toString(), this.preparePosition.toString()].join("/");
};


const EventReadStatus = {
  Success: 'success',
  NotFound: 'notFound',
  NoStream: 'noStream',
  StreamDeleted: 'streamDeleted'
};
Object.freeze(EventReadStatus);

/**
 * @param {object} ev
 * @constructor
 * @property {string} eventStreamId
 * @property {string} eventId
 * @property {Long} eventNumber
 * @property {string} eventType
 * @property {number} createdEpoch
 * @property {?Buffer} data
 * @property {?Buffer} metadata
 * @property {boolean} isJson
 */
function RecordedEvent(ev) {
  this.eventStreamId = ev.eventStreamId;
  this.eventId = guidParse.unparse(ev.eventId);
  this.eventNumber = ev.eventNumber;
  this.eventType = ev.eventType;
  this.created = new Date(ev.createdEpoch ? ev.createdEpoch.toNumber() : 0);
  this.createdEpoch = ev.createdEpoch ? ev.createdEpoch.toNumber() : 0;
  this.data = ev.data ? ev.data : new Buffer(0);
  this.metadata = ev.metadata ? ev.metadata : new Buffer(0);
  this.isJson = ev.dataContentType === 1;
  Object.freeze(this);
}

/**
 * @param {object} ev
 * @constructor
 * @property {?RecordedEvent} event
 * @property {?RecordedEvent} link
 * @property {?RecordedEvent} originalEvent
 * @property {boolean} isResolved
 * @property {?Position} originalPosition
 * @property {string} originalStreamId
 * @property {Long} originalEventNumber
 */
function ResolvedEvent(ev) {
  this.event = ev.event === null ? null : new RecordedEvent(ev.event);
  this.link = ev.link === null ? null : new RecordedEvent(ev.link);
  this.originalEvent = this.link || this.event;
  this.isResolved = this.link !== null && this.event !== null;
  this.originalPosition = (ev.commitPosition && ev.preparePosition) ? new Position(ev.commitPosition, ev.preparePosition) : null;
  this.originalStreamId = this.originalEvent && this.originalEvent.eventStreamId;
  this.originalEventNumber = this.originalEvent && this.originalEvent.eventNumber;
  Object.freeze(this);
}

/**
 *
 * @param {string} status
 * @param {string} stream
 * @param {Long} eventNumber
 * @param {object} event
 * @constructor
 * @property {string} status
 * @property {string} stream
 * @property {Long} eventNumber
 * @property {ResolvedEvent} event
 */
function EventReadResult(status, stream, eventNumber, event) {
  this.status = status;
  this.stream = stream;
  this.eventNumber = eventNumber;
  this.event = status === EventReadStatus.Success ? new ResolvedEvent(event) : null;
  Object.freeze(this);
}

/**
 * @param {number} nextExpectedVersion
 * @param {Position} logPosition
 * @constructor
 * @property {Long} nextExpectedVersion
 * @property {Position} logPosition
 */
function WriteResult(nextExpectedVersion, logPosition) {
  this.nextExpectedVersion = nextExpectedVersion;
  this.logPosition = logPosition;
  Object.freeze(this);
}

/**
 * @param {string} status
 * @param {string} stream
 * @param {Long} fromEventNumber
 * @param {string} readDirection
 * @param {object[]} events
 * @param {Long} nextEventNumber
 * @param {Long} lastEventNumber
 * @param {boolean} isEndOfStream
 * @constructor
 * @property {string} status
 * @property {string} stream
 * @property {Long} fromEventNumber
 * @property {string} readDirection
 * @property {ResolvedEvent[]} events
 * @property {Long} nextEventNumber
 * @property {Long} lastEventNumber
 * @property {boolean} isEndOfStream
 */
function StreamEventsSlice(
    status, stream, fromEventNumber, readDirection, events, nextEventNumber, lastEventNumber, isEndOfStream
) {
  this.status = status;
  this.stream = stream;
  this.fromEventNumber = fromEventNumber;
  this.readDirection = readDirection;
  this.events = events ? events.map(function(ev) { return new ResolvedEvent(ev); }) : [];
  this.nextEventNumber = nextEventNumber;
  this.lastEventNumber = lastEventNumber;
  this.isEndOfStream = isEndOfStream;
  Object.freeze(this);
}

/**
 * @param {string} readDirection
 * @param {Position} fromPosition
 * @param {Position} nextPosition
 * @param {ResolvedEvent[]} events
 * @constructor
 * @property {string} readDirection
 * @property {Position} fromPosition
 * @property {Position} nextPosition
 * @property {ResolvedEvent[]} events
 */
function AllEventsSlice(readDirection, fromPosition, nextPosition, events) {
  this.readDirection = readDirection;
  this.fromPosition = fromPosition;
  this.nextPosition = nextPosition;
  this.events = events ? events.map(function(ev){ return new ResolvedEvent(ev); }) : [];
  this.isEndOfStream = events === null || events.length === 0;
  Object.freeze(this);
}

/**
 * @param {Position} logPosition
 * @constructor
 * @property {Position} logPosition
 */
function DeleteResult(logPosition) {
  this.logPosition = logPosition;
  Object.freeze(this);
}

/**
 * @param {string} stream
 * @param {boolean} isStreamDeleted
 * @param {Long} metastreamVersion
 * @param {object} streamMetadata
 * @constructor
 * @property {string} stream
 * @property {boolean} isStreamDeleted
 * @property {Long} metastreamVersion
 * @property {object} streamMetadata
 */
function RawStreamMetadataResult(stream, isStreamDeleted, metastreamVersion, streamMetadata) {
  ensure.notNullOrEmpty(stream);
  this.stream = stream;
  this.isStreamDeleted = isStreamDeleted;
  this.metastreamVersion = metastreamVersion;
  this.streamMetadata = streamMetadata;
  Object.freeze(this);
}

const PersistentSubscriptionCreateStatus = {
  Success: 'success',
  NotFound: 'notFound',
  Failure: 'failure'
};
Object.freeze(PersistentSubscriptionCreateStatus);

/**
 * @param {string} status
 * @constructor
 * @property {string} status
 */
function PersistentSubscriptionCreateResult(status) {
  this.status = status;
  Object.freeze(this);
}

const PersistentSubscriptionUpdateStatus = {
  Success: 'success',
  NotFound: 'notFound',
  Failure: 'failure',
  AccessDenied: 'accessDenied'
};
Object.freeze(PersistentSubscriptionUpdateStatus);

/**
 * @param {string} status
 * @constructor
 * @property {string} status
 */
function PersistentSubscriptionUpdateResult(status) {
  this.status = status;
  Object.freeze(this);
}

const PersistentSubscriptionDeleteStatus = {
  Success: 'success',
  Failure: 'failure'
};
Object.freeze(PersistentSubscriptionDeleteStatus);

/**
 * @param {string} status
 * @constructor
 * @property {string} status
 */
function PersistentSubscriptionDeleteResult(status) {
  this.status = status;
  Object.freeze(this);
}

// Exports Constructors
module.exports.Position = Position;
module.exports.ResolvedEvent = ResolvedEvent;
module.exports.EventReadStatus = EventReadStatus;
module.exports.EventReadResult = EventReadResult;
module.exports.WriteResult = WriteResult;
module.exports.StreamEventsSlice = StreamEventsSlice;
module.exports.AllEventsSlice = AllEventsSlice;
module.exports.DeleteResult = DeleteResult;
module.exports.RawStreamMetadataResult = RawStreamMetadataResult;
module.exports.PersistentSubscriptionCreateResult = PersistentSubscriptionCreateResult;
module.exports.PersistentSubscriptionCreateStatus = PersistentSubscriptionCreateStatus;
module.exports.PersistentSubscriptionUpdateResult = PersistentSubscriptionUpdateResult;
module.exports.PersistentSubscriptionUpdateStatus = PersistentSubscriptionUpdateStatus;
module.exports.PersistentSubscriptionDeleteResult = PersistentSubscriptionDeleteResult;
module.exports.PersistentSubscriptionDeleteStatus = PersistentSubscriptionDeleteStatus;
