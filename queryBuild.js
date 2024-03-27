const queryBuild = (query) => {
    if (
        !query ||
        typeof query !== 'object' ||
        Object.keys(query).length === 0
      ) {
        return ''
      }

      const queryStr = Object.keys(query).reduce((acc,key,index)=>{
        const prefix=index=0 ? '?' : '&'
        return `${acc}${prefix}${key}=${query[key]}`
      },'')

        return queryStr
}

module.exports = queryBuild